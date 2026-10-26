(function() {
  // ========== DATA ==========
  const initialTasks = [
    { id: 'task-1', text: 'Morning standup', badge: '9:30' },
    { id: 'task-2', text: 'Design review', badge: '11:00' },
    { id: 'task-3', text: 'Update dashboard', badge: '14:00' },
    { id: 'task-4', text: 'Write documentation', badge: '16:00' },
    { id: 'task-5', text: 'Team sync', badge: '15:30' },
  ];

  const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

  // State
  let checklistTasks = [];              // tasks not yet scheduled
  let calendarSlots = {};               // hour -> [tasks]
  let statusMap = {};                   // taskId -> 'todo' | 'progress' | 'completed'

  // DOM
  const checklistContainer = document.getElementById('checklistItems');
  const calendarGrid = document.getElementById('calendarGrid');
  const todoItems = document.getElementById('todoItems');
  const progressItems = document.getElementById('progressItems');
  const completedItems = document.getElementById('completedItems');
  const todoCount = document.getElementById('todoCount');
  const progressCount = document.getElementById('progressCount');
  const completedCount = document.getElementById('completedCount');

  // ========== INITIALIZE ==========
  function initializeData() {
    checklistTasks = initialTasks.map(t => ({ ...t }));
    HOURS.forEach(hour => { calendarSlots[hour] = []; });

    // Every task starts as "todo"
    statusMap = {};
    initialTasks.forEach(t => { statusMap[t.id] = 'todo'; });
  }

  // Helper: get all tasks (checklist + calendar)
  function getAllTasks() {
    const all = [...checklistTasks];
    HOURS.forEach(hour => {
      (calendarSlots[hour] || []).forEach(t => {
        if (!all.some(x => x.id === t.id)) all.push(t);
      });
    });
    return all;
  }

  // ========== RENDER STATUS BARS ==========
  function renderStatusBars() {
    const allTasks = getAllTasks();

    // Group by status with safe fallback
    const grouped = { todo: [], progress: [], completed: [] };
    allTasks.forEach(task => {
      let status = statusMap[task.id];
      // Validate status, default to 'todo' if invalid
      if (status !== 'todo' && status !== 'progress' && status !== 'completed') {
        status = 'todo';
        statusMap[task.id] = 'todo';
      }
      grouped[status].push(task);
    });

    // Update counts
    todoCount.textContent = grouped.todo.length;
    progressCount.textContent = grouped.progress.length;
    completedCount.textContent = grouped.completed.length;

    // Render each list
    renderStatusList(todoItems, grouped.todo, 'todo');
    renderStatusList(progressItems, grouped.progress, 'progress');
    renderStatusList(completedItems, grouped.completed, 'completed');
  }

  function renderStatusList(container, tasks, status) {
    container.innerHTML = '';
    if (tasks.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'status-empty';
      empty.textContent = status === 'todo' ? 'No tasks' : status === 'progress' ? 'Nothing in progress' : 'No completed tasks';
      container.appendChild(empty);
      return;
    }

    tasks.forEach(task => {
      const card = createTaskCard(task, 'status', status);
      card.dataset.status = status;
      container.appendChild(card);
    });
  }

  // ========== RENDER CHECKLIST ==========
  function renderChecklist() {
    if (checklistTasks.length === 0) {
      checklistContainer.innerHTML =
        '<div class="empty-message">✨ All tasks scheduled! Drag from calendar to bring back.</div>';
      return;
    }

    checklistContainer.innerHTML = '';
    checklistTasks.forEach(task => {
      const card = createTaskCard(task, 'checklist');
      checklistContainer.appendChild(card);
    });
  }

  // ========== RENDER CALENDAR ==========
  function renderCalendar() {
    calendarGrid.innerHTML = '';

    HOURS.forEach(hour => {
      const row = document.createElement('div');
      row.className = 'calendar-row';

      const label = document.createElement('div');
      label.className = 'time-label';
      const ampm = hour >= 12 ? 'pm' : 'am';
      let displayHour = hour % 12;
      displayHour = displayHour === 0 ? 12 : displayHour;
      label.textContent = `${displayHour}${ampm}`;

      const slot = document.createElement('div');
      slot.className = 'time-slot';
      slot.dataset.hour = hour;
      slot.setAttribute('aria-label', `Time slot ${hour}:00`);

      const hourTasks = calendarSlots[hour] || [];
      hourTasks.forEach(task => {
        const card = createTaskCard(task, 'calendar');
        card.dataset.hour = hour;
        slot.appendChild(card);
      });

      attachSlotDropListeners(slot);

      row.appendChild(label);
      row.appendChild(slot);
      calendarGrid.appendChild(row);
    });
  }

  // ========== CREATE TASK CARD ==========
  function createTaskCard(task, location, statusOverride) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.draggable = true;
    card.dataset.taskId = task.id;
    card.dataset.location = location;

    if (statusOverride) card.dataset.status = statusOverride;

    const textSpan = document.createElement('span');
    textSpan.textContent = task.text;

    const badgeSpan = document.createElement('span');
    badgeSpan.className = 'task-badge';
    badgeSpan.textContent = task.badge || '';

    card.appendChild(textSpan);
    if (task.badge) card.appendChild(badgeSpan);

    // Drag start
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', task.id);
      e.dataTransfer.effectAllowed = 'move';

      const sourceLocation = card.dataset.location;
      e.dataTransfer.setData('source-location', sourceLocation);

      if (sourceLocation === 'calendar') {
        e.dataTransfer.setData('source-hour', card.dataset.hour);
      }
      if (sourceLocation === 'status') {
        e.dataTransfer.setData('source-status', card.dataset.status);
      }

      card.classList.add('dragging');
    });

    // Drag end
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.time-slot.drag-over').forEach(el => {
        el.classList.remove('drag-over');
      });
      document.querySelectorAll('.status-bar.drag-over').forEach(el => {
        el.classList.remove('drag-over');
      });
    });

    return card;
  }

  // ========== REMOVE TASK FROM CURRENT LOCATION ==========
  function removeTaskFromSource(taskId, sourceLocation, sourceHour, sourceStatus) {
    let taskObj = null;

    if (sourceLocation === 'checklist') {
      const idx = checklistTasks.findIndex(t => t.id === taskId);
      if (idx !== -1) {
        taskObj = checklistTasks[idx];
        checklistTasks.splice(idx, 1);
      }
    } else if (sourceLocation === 'calendar' && sourceHour) {
      const srcHourNum = parseInt(sourceHour, 10);
      const srcTasks = calendarSlots[srcHourNum] || [];
      const idx = srcTasks.findIndex(t => t.id === taskId);
      if (idx !== -1) {
        taskObj = srcTasks[idx];
        srcTasks.splice(idx, 1);
      }
    } else if (sourceLocation === 'status') {
      // Status bars are views, not storage. The task stays in checklist/calendar.
      const all = getAllTasks();
      taskObj = all.find(t => t.id === taskId) || null;
    }

    // Fallback
    if (!taskObj) {
      const fallback = initialTasks.find(t => t.id === taskId);
      if (fallback) taskObj = { ...fallback };
    }

    return taskObj;
  }

  // ========== SLOT DROP LISTENERS ==========
  function attachSlotDropListeners(slot) {
    slot.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      slot.classList.add('drag-over');
    });

    slot.addEventListener('dragleave', () => {
      slot.classList.remove('drag-over');
    });

    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      slot.classList.remove('drag-over');

      const taskId = e.dataTransfer.getData('text/plain');
      const sourceLocation = e.dataTransfer.getData('source-location');
      const sourceHour = e.dataTransfer.getData('source-hour');
      const sourceStatus = e.dataTransfer.getData('source-status');

      if (!taskId) return;

      const targetHour = parseInt(slot.dataset.hour, 10);
      if (isNaN(targetHour)) return;

      // Remove from source
      const taskObj = removeTaskFromSource(taskId, sourceLocation, sourceHour, sourceStatus);

      if (taskObj) {
        // Add to calendar slot
        if (!calendarSlots[targetHour]) calendarSlots[targetHour] = [];
        if (!calendarSlots[targetHour].some(t => t.id === taskObj.id)) {
          calendarSlots[targetHour].push({ ...taskObj });
        }
        // Auto-move to "In Progress" when scheduled on calendar
        statusMap[taskObj.id] = 'progress';
      }

      renderAll();
    });
  }

  // ========== CHECKLIST DROP LISTENERS ==========
  function attachChecklistDropListeners() {
    checklistContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    checklistContainer.addEventListener('drop', (e) => {
      e.preventDefault();

      const taskId = e.dataTransfer.getData('text/plain');
      const sourceLocation = e.dataTransfer.getData('source-location');
      const sourceHour = e.dataTransfer.getData('source-hour');
      const sourceStatus = e.dataTransfer.getData('source-status');

      if (!taskId) return;

      if (sourceLocation === 'checklist') return;

      // Remove from source
      const taskObj = removeTaskFromSource(taskId, sourceLocation, sourceHour, sourceStatus);

      if (taskObj) {
        if (!checklistTasks.some(t => t.id === taskObj.id)) {
          checklistTasks.push({ ...taskObj });
        }
        // When moved back to checklist, reset to "todo"
        statusMap[taskObj.id] = 'todo';
      }

      renderAll();
    });
  }

  // ========== STATUS BAR DROP LISTENERS ==========
  function attachStatusDropListeners() {
    document.querySelectorAll('.status-bar').forEach(bar => {
      bar.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        bar.classList.add('drag-over');
      });

      bar.addEventListener('dragleave', () => {
        bar.classList.remove('drag-over');
      });

      bar.addEventListener('drop', (e) => {
        e.preventDefault();
        bar.classList.remove('drag-over');

        const taskId = e.dataTransfer.getData('text/plain');
        const sourceLocation = e.dataTransfer.getData('source-location');
        const sourceHour = e.dataTransfer.getData('source-hour');
        const sourceStatus = e.dataTransfer.getData('source-status');

        if (!taskId) return;

        const newStatus = bar.dataset.status;
        if (!newStatus) return;

        // If dragging from a status bar, just update status (task stays in place)
        if (sourceLocation === 'status') {
          statusMap[taskId] = newStatus;
          renderAll();
          return;
        }

        // Otherwise, remove from source location and add to checklist
        const taskObj = removeTaskFromSource(taskId, sourceLocation, sourceHour, sourceStatus);

        if (taskObj) {
          // Ensure the task exists in checklist (status bars are views)
          if (!checklistTasks.some(t => t.id === taskObj.id)) {
            checklistTasks.push({ ...taskObj });
          }
          statusMap[taskObj.id] = newStatus;
        }

        renderAll();
      });
    });
  }

  // ========== RENDER ALL ==========
  function renderAll() {
    renderChecklist();
    renderCalendar();
    renderStatusBars();
  }

  // ========== INIT ==========
  function init() {
    initializeData();
    renderAll();
    attachChecklistDropListeners();
    attachStatusDropListeners();
  }

  init();
})();