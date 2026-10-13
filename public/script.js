const projects = [];

const form = document.querySelector("#project-form");
const nameInput = document.querySelector("#name");
const statusInput = document.querySelector("#status");
const projectList = document.querySelector("#project-list");
const emptyState = document.querySelector("#empty-state");

function renderProjects() {
  // Remove previously displayed items.
  projectList.replaceChildren();

  // Display every project in the array.
  projects.forEach((project) => {
    const listItem = document.createElement("li");

    const projectName = document.createElement("span");
    projectName.textContent = project.name;

    const projectStatus = document.createElement("span");
    projectStatus.textContent = ` — ${project.status}`;

    listItem.append(projectName, projectStatus);
    projectList.appendChild(listItem);
  });

  // Update the empty-state message when available.
  if (emptyState) {
    emptyState.hidden = projects.length > 0;
  }
}

// Handle form submission.
form.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const status = statusInput.value;

  // Reject an empty or whitespace-only project name.
  if (!name) {
    nameInput.focus();
    return;
  }

  // Create a project with a unique ID.
  const project = {
    id: crypto.randomUUID(),
    name: name,
    status: status
  };

  // Add the project and refresh the displayed list.
  projects.push(project);
  renderProjects();

  // Reset the form for the next project.
  form.reset();
  nameInput.focus();
});

// Display the initial empty state.
renderProjects();