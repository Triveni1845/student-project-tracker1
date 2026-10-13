const STORAGE_KEY = "workshop-projects-v1";

let projects = [];
let editingId = null;
let storageAvailable = true;

const form = document.querySelector("#project-form");
const nameInput = document.querySelector("#name");
const statusInput = document.querySelector("#status");
const projectList = document.querySelector("#project-list");
const emptyState = document.querySelector("#empty-state");
const saveButton = document.querySelector("#save-button");
const cancelButton = document.querySelector("#cancel-button");
const message = document.querySelector("#message");

// Display a message without interpreting it as HTML.
function showMessage(text) {
  message.textContent = text;
}

// Check that stored data contains valid project records.
function isValidProjects(data) {
  if (!Array.isArray(data)) {
    return false;
  }

  const ids = new Set();

  return data.every((project) => {
    if (
      project === null ||
      typeof project !== "object" ||
      typeof project.id !== "string" ||
      project.id.trim() === "" ||
      typeof project.name !== "string" ||
      project.name.trim() === "" ||
      typeof project.status !== "string" ||
      !["Planned", "In Progress", "Completed"].includes(project.status)
    ) {
      return false;
    }

    if (ids.has(project.id)) {
      return false;
    }

    ids.add(project.id);
    return true;
  });
}

// Read and restore saved projects.
function loadProjects() {
  let storedData;

  try {
    storedData = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    storageAvailable = false;
    showMessage(
      "Projects could not be loaded because browser storage is unavailable. Changes cannot be saved."
    );
    return;
  }

  // No saved data: start with an empty collection.
  if (storedData === null) {
    projects = [];
    return;
  }

  try {
    const parsedData = JSON.parse(storedData);

    if (!isValidProjects(parsedData)) {
      storageAvailable = false;
      showMessage(
        "Saved project data is invalid. It has been preserved and was not overwritten."
      );
      return;
    }

    projects = parsedData;
  } catch (error) {
    storageAvailable = false;
    showMessage(
      "Saved project data could not be read. It has been preserved and was not overwritten."
    );
  }
}

// Save a collection to localStorage.
// Return true only if the write succeeds.
function saveProjects() {
  if (!storageAvailable) {
    showMessage(
      "Changes could not be saved because browser storage is unavailable or the saved data is invalid."
    );
    return false;
  }

  try {
    const serializedProjects = JSON.stringify(projects);
    localStorage.setItem(STORAGE_KEY, serializedProjects);
    showMessage("");
    return true;
  } catch (error) {
    showMessage(
      "Changes could not be saved to browser storage. Your current changes may be lost if you refresh."
    );
    return false;
  }
}

// Render every project in the collection.
function renderProjects() {
  projectList.replaceChildren();

  projects.forEach((project) => {
    const listItem = document.createElement("li");

    const projectName = document.createElement("span");
    projectName.textContent = project.name;

    const projectStatus = document.createElement("span");
    projectStatus.textContent = ` — ${project.status} `;

    // Edit button.
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";

    editButton.addEventListener("click", () => {
      if (!storageAvailable) {
        showMessage(
          "Editing is unavailable because saved data could not be loaded safely."
        );
        return;
      }

      editingId = project.id;
      nameInput.value = project.name;
      statusInput.value = project.status;

      saveButton.textContent = "Save changes";
      cancelButton.hidden = false;

      showMessage("");
      nameInput.focus();
    });

    // Delete button.
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";

    deleteButton.addEventListener("click", () => {
      const confirmed = window.confirm(
        `Are you sure you want to delete "${project.name}"?`
      );

      if (!confirmed) {
        return;
      }

      if (!storageAvailable) {
        showMessage(
          "Deletion is unavailable because saved data could not be loaded safely."
        );
        return;
      }

      const projectIndex = projects.findIndex(
        (item) => item.id === project.id
      );

      if (projectIndex === -1) {
        return;
      }

      // Prepare the updated collection without changing the current one.
      const updatedProjects = projects.filter(
        (item) => item.id !== project.id
      );

      // Save before committing the change to the active collection.
      const previousProjects = projects;
      projects = updatedProjects;

      if (!saveProjects()) {
        projects = previousProjects;
        renderProjects();
        return;
      }

      // Reset the form if the deleted project was being edited.
      if (editingId === project.id) {
        resetForm();
      }

      renderProjects();
    });

    listItem.append(
      projectName,
      projectStatus,
      editButton,
      deleteButton
    );

    projectList.appendChild(listItem);
  });

  if (emptyState) {
    emptyState.hidden = projects.length > 0;
  }
}

// Return the form to Add mode.
function resetForm() {
  form.reset();
  editingId = null;

  saveButton.textContent = "Save Project";
  cancelButton.hidden = true;
}

// Handle Add and Edit with one submit listener.
form.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!storageAvailable) {
    showMessage(
      "Changes cannot be saved because browser storage is unavailable or the saved data is invalid."
    );
    return;
  }

  const name = nameInput.value.trim();
  const status = statusInput.value;

  if (!name) {
    showMessage("Please enter a project name.");
    nameInput.focus();
    return;
  }

  if (!["Planned", "In Progress", "Completed"].includes(status)) {
    showMessage("Please select a valid project status.");
    return;
  }

  // Work on a copy so failed storage writes do not commit the change.
  const updatedProjects = projects.map((project) => ({ ...project }));

  if (editingId === null) {
    // Add a new project.
    updatedProjects.push({
      id: crypto.randomUUID(),
      name: name,
      status: status
    });
  } else {
    // Update the existing project using its stable ID.
    const project = updatedProjects.find(
      (item) => item.id === editingId
    );

    if (!project) {
      showMessage(
        "The project being edited could not be found. Please try again."
      );
      resetForm();
      return;
    }

    project.name = name;
    project.status = status;
  }

  const previousProjects = projects;
  projects = updatedProjects;

  if (!saveProjects()) {
    projects = previousProjects;
    renderProjects();
    return;
  }

  renderProjects();
  resetForm();
  nameInput.focus();
});

// Cancel edit without changing saved data.
cancelButton.addEventListener("click", () => {
  resetForm();
  showMessage("");
  nameInput.focus();
});

// Load saved projects before the first render.
loadProjects();
renderProjects();