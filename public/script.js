let projects = [];
let editingId = null;
let isLoading = false;
let isSaving = false;
let loadFailed = false;

const form = document.querySelector("#project-form");
const nameInput = document.querySelector("#name");
const statusInput = document.querySelector("#status");
const projectList = document.querySelector("#project-list");
const emptyState = document.querySelector("#empty-state");
const saveButton = document.querySelector("#save-button");
const cancelButton = document.querySelector("#cancel-button");
const message = document.querySelector("#message");

const allowedStatuses = ["Planned", "In Progress", "Completed"];

// Display messages safely.
function showMessage(text) {
  message.textContent = text;
}

// Enable or disable controls while requests are running.
function updateControls() {
  const mutationBlocked = isLoading || isSaving || loadFailed;

  nameInput.disabled = mutationBlocked;
  statusInput.disabled = mutationBlocked;
  saveButton.disabled = mutationBlocked;
  cancelButton.disabled = mutationBlocked || editingId === null;

  projectList.querySelectorAll("button").forEach((button) => {
    button.disabled = mutationBlocked;
  });
}

// Read an API error message when the server returns JSON.
async function getErrorMessage(response) {
  try {
    const data = await response.json();

    if (typeof data.error === "string" && data.error.trim()) {
      return data.error;
    }
  } catch (error) {
    // The response may not contain valid JSON.
  }

  return `Request failed with status ${response.status}.`;
}

// Check that the API returned a valid collection without duplicate IDs.
function isValidProjects(data) {
  if (!Array.isArray(data)) {
    return false;
  }

  const ids = new Set();

  for (const project of data) {
    if (
      project === null ||
      typeof project !== "object" ||
      !(
        (typeof project.id === "number" && Number.isSafeInteger(project.id)) ||
        (typeof project.id === "string" && project.id.trim() !== "")
      ) ||
      (typeof project.id === "number" && project.id < 1) ||
      (typeof project.id === "string" && project.id.trim() === "") ||
      typeof project.name !== "string" ||
      project.name.trim() === "" ||
      typeof project.status !== "string" ||
      !allowedStatuses.includes(project.status)
    ) {
      return false;
    }

    const idKey = String(project.id);

    if (ids.has(idKey)) {
      return false;
    }

    ids.add(idKey);
  }

  return true;
}

// Render the current API collection.
function renderProjects() {
  projectList.replaceChildren();

  for (const project of projects) {
    const listItem = document.createElement("li");

    const projectName = document.createElement("span");
    projectName.textContent = project.name;

    const projectStatus = document.createElement("span");
    projectStatus.textContent = ` — ${project.status} `;

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";

    editButton.addEventListener("click", () => {
      if (isLoading || isSaving || loadFailed) {
        return;
      }

      // Use the record's existing server-generated ID.
      editingId = project.id;
      nameInput.value = project.name;
      statusInput.value = project.status;

      saveButton.textContent = "Save changes";
      cancelButton.hidden = false;

      showMessage("Editing project.");
      updateControls();
      nameInput.focus();
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";

    deleteButton.addEventListener("click", async () => {
      if (isLoading || isSaving || loadFailed) {
        return;
      }

      const confirmed = window.confirm(
        `Are you sure you want to delete "${project.name}"?`
      );

      if (!confirmed) {
        return;
      }

      await deleteProject(project);
    });

    listItem.append(
      projectName,
      projectStatus,
      editButton,
      deleteButton
    );

    projectList.appendChild(listItem);
  }

  emptyState.hidden = projects.length > 0;
}

// Load projects from the API. The API is the source of truth.
async function loadProjects({ showLoadingMessage = true } = {}) {
  isLoading = true;
  loadFailed = false;

  if (showLoadingMessage) {
    showMessage("Loading projects...");
  }

  updateControls();

  try {
    const response = await fetch("/api/projects");

    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }

    const data = await response.json();

    if (!isValidProjects(data)) {
      throw new Error("The server returned an invalid project list.");
    }

    projects = data;

    // If the edited project no longer exists, leave Edit mode.
    if (
      editingId !== null &&
      !projects.some((project) => String(project.id) === String(editingId))
    ) {
      resetForm();
    }

    renderProjects();

    if (projects.length === 0) {
      showMessage("No projects yet. Add your first project.");
    } else if (showLoadingMessage) {
      showMessage("Projects loaded successfully.");
    }

    return true;
  } catch (error) {
    loadFailed = true;

    if (error instanceof TypeError) {
      showMessage(
        "Could not connect to the server. Check that the server is running and try again."
      );
    } else {
      showMessage(`Could not load projects: ${error.message}`);
    }

    return false;
  } finally {
    isLoading = false;
    updateControls();
  }
}

// Return the form to Add mode.
function resetForm() {
  form.reset();
  editingId = null;

  saveButton.textContent = "Save Project";
  cancelButton.hidden = true;

  updateControls();
}

// Send JSON to the API to create or update a project.
async function saveProject(name, status) {
  isSaving = true;
  showMessage(editingId === null ? "Saving new project..." : "Saving changes...");
  updateControls();

  const wasEditing = editingId !== null;
  const currentEditingId = editingId;

  const url = wasEditing
    ? `/api/projects/${encodeURIComponent(currentEditingId)}`
    : "/api/projects";

  const method = wasEditing ? "PUT" : "POST";

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name, status })
    });

    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }

    // Reload the server collection after the successful mutation.
    const loaded = await loadProjects({ showLoadingMessage: false });

    if (!loaded) {
      showMessage(
        "The change was accepted by the server, but the project list could not be refreshed. Try again."
      );
      return;
    }

    resetForm();
    nameInput.focus();
    showMessage(wasEditing ? "Project updated successfully." : "Project added successfully.");
  } catch (error) {
    if (error instanceof TypeError) {
      showMessage(
        "Could not connect to the server. Your change may not have been saved. Please try again."
      );
    } else {
      showMessage(`Could not save project: ${error.message}`);
    }
  } finally {
    isSaving = false;
    updateControls();
  }
}

// Delete a project only after confirmation.
async function deleteProject(project) {
  isSaving = true;
  showMessage("Deleting project...");
  updateControls();

  try {
    const response = await fetch(
      `/api/projects/${encodeURIComponent(project.id)}`,
      { method: "DELETE" }
    );

    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }

    // Leave Edit mode if the deleted record was being edited.
    if (
      editingId !== null &&
      String(editingId) === String(project.id)
    ) {
      resetForm();
    }

    const loaded = await loadProjects({ showLoadingMessage: false });

    if (!loaded) {
      showMessage(
        "The project was deleted on the server, but the list could not be refreshed. Try again."
      );
      return;
    }

    showMessage("Project deleted successfully.");
  } catch (error) {
    if (error instanceof TypeError) {
      showMessage(
        "Could not connect to the server. The project may not have been deleted. Please try again."
      );
    } else {
      showMessage(`Could not delete project: ${error.message}`);
    }
  } finally {
    isSaving = false;
    updateControls();
  }
}

// One submit listener handles both Add and Edit.
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (isLoading || isSaving || loadFailed) {
    showMessage("Please wait until the project list is available.");
    return;
  }

  const name = nameInput.value.trim();
  const status = statusInput.value;

  if (!name) {
    showMessage("Please enter a project name.");
    nameInput.focus();
    return;
  }

  if (name.length > 80) {
    showMessage("Project name must be 80 characters or fewer.");
    nameInput.focus();
    return;
  }

  if (!allowedStatuses.includes(status)) {
    showMessage("Please select a valid project status.");
    return;
  }

  if (editingId !== null) {
    const existingProject = projects.find(
      (project) => String(project.id) === String(editingId)
    );

    if (!existingProject) {
      showMessage("The project being edited no longer exists. Reload the list.");
      resetForm();
      return;
    }
  }

  await saveProject(name, status);
});

// Cancel edit without sending an API request.
cancelButton.addEventListener("click", () => {
  if (isLoading || isSaving) {
    return;
  }

  resetForm();
  showMessage("Edit cancelled.");
  nameInput.focus();
});

// Load server records when the page starts.
updateControls();
loadProjects();