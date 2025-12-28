// UI manager for tabs, controls, and state updates.

export class UIManager {
  constructor({ state, camera, onClear, onDebugToggle }) {
    this.state = state;
    this.camera = camera;
    this.onClear = onClear;
    this.onDebugToggle = onDebugToggle;

    this.tabs = document.querySelectorAll(".tab-btn");
    this.contents = document.querySelectorAll(".tab-content");
    this.toggleBtn = document.getElementById("toggleUI");
    this.uiPanel = document.getElementById("ui");
    this.status = document.getElementById("status");

    this.bindTabs();
    this.bindToggle();
    this.bindControls();
    this.syncDefaults();
  }

  bindTabs() {
    this.tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        this.tabs.forEach((t) => t.classList.remove("active"));
        this.contents.forEach((c) => c.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById(tab.dataset.tab).classList.add("active");
      });
    });
  }

  bindToggle() {
    this.toggleBtn.addEventListener("click", () => {
      this.uiPanel.classList.toggle("minimized");
      this.toggleBtn.textContent = this.uiPanel.classList.contains("minimized")
        ? "+"
        : "−";
    });
  }

  bindControls() {
    document.getElementById("clearBtn").addEventListener("click", () => {
      this.onClear();
    });

    document.getElementById("zoom").addEventListener("input", (event) => {
      this.camera.position.z = parseFloat(event.target.value);
      this.camera.lookAt(this.state.cameraTarget);
    });
    document
      .getElementById("duration")
      .addEventListener("input", (event) => {
        this.state.spawnDuration = parseFloat(event.target.value);
      });
    document.getElementById("gravity").addEventListener("input", (event) => {
      this.state.gravity.y = parseFloat(event.target.value);
    });
    document.getElementById("friction").addEventListener("input", (event) => {
      this.state.friction = parseFloat(event.target.value);
    });
    document
      .getElementById("stiffness")
      .addEventListener("input", (event) => {
        this.state.paperStiffness = parseFloat(event.target.value);
      });
    document
      .getElementById("thickness")
      .addEventListener("input", (event) => {
        this.state.collisionThickness = parseFloat(event.target.value);
      });
    document.getElementById("wind").addEventListener("input", (event) => {
      this.state.windMultiplier = parseFloat(event.target.value);
    });
    document
      .getElementById("windSpeed")
      .addEventListener("input", (event) => {
        this.state.windSpeed = parseFloat(event.target.value);
      });
    document
      .getElementById("flutter")
      .addEventListener("input", (event) => {
        this.state.flutterFreq = parseFloat(event.target.value);
      });
    document
      .getElementById("windDirX")
      .addEventListener("input", (event) => {
        this.state.windDirX = parseFloat(event.target.value);
      });
    document
      .getElementById("windDirY")
      .addEventListener("input", (event) => {
        this.state.windDirY = parseFloat(event.target.value);
      });

    document.getElementById("meshRes").addEventListener("input", (event) => {
      this.state.meshResolution = parseInt(event.target.value, 10);
      document.getElementById("resVal").innerText = this.state.meshResolution;
    });

    document.getElementById("debugToggle").addEventListener("change", (event) => {
      this.state.debugMode = event.target.checked;
      this.onDebugToggle(this.state.debugMode);
    });
  }

  syncDefaults() {
    document.getElementById("zoom").value = this.camera.position.z;
    document.getElementById("duration").value = this.state.spawnDuration;
    document.getElementById("gravity").value = this.state.gravity.y;
    document.getElementById("friction").value = this.state.friction;
    document.getElementById("stiffness").value = this.state.paperStiffness;
    document.getElementById("thickness").value = this.state.collisionThickness;
    document.getElementById("wind").value = this.state.windMultiplier;
    document.getElementById("windSpeed").value = this.state.windSpeed;
    document.getElementById("flutter").value = this.state.flutterFreq;
    document.getElementById("windDirX").value = this.state.windDirX;
    document.getElementById("windDirY").value = this.state.windDirY;
    document.getElementById("meshRes").value = this.state.meshResolution;
    document.getElementById("resVal").innerText = this.state.meshResolution;
  }

  setNotesCount(count) {
    this.status.innerText = `Notes: ${count}`;
  }
}
