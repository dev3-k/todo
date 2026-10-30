(() => {
  'use strict';

  const STORAGE_KEY = 'todo-app.items.v1';

  const FILTERS = {
    all: () => true,
    active: (todo) => !todo.done,
    done: (todo) => todo.done,
  };

  const EMPTY_MESSAGES = {
    all: 'タスクはまだありません。上の入力欄から追加しましょう。',
    active: '未完了のタスクはありません。',
    done: '完了したタスクはありません。',
  };

  const form = document.getElementById('add-form');
  const input = document.getElementById('new-todo');
  const list = document.getElementById('todo-list');
  const emptyMessage = document.getElementById('empty');
  const count = document.getElementById('count');
  const clearDone = document.getElementById('clear-done');
  const filterButtons = document.querySelectorAll('[data-filter]');

  let todos = load();
  let filter = 'all';
  let editingId = null;

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!Array.isArray(data)) return [];
      return data
        .filter((t) => t && typeof t.id === 'string' && typeof t.text === 'string')
        .map((t) => ({ id: t.id, text: t.text, done: t.done === true }));
    } catch {
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch {
      // 保存できない環境でも、画面上の操作は続けられるようにする
    }
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function idOf(el) {
    return el.closest('.todo-item').dataset.id;
  }

  function actionButton(action, label, todo) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'link-button';
    button.dataset.action = action;
    button.textContent = label;
    button.setAttribute('aria-label', `「${todo.text}」を${label}`);
    return button;
  }

  function createEditor(todo) {
    const editor = document.createElement('input');
    editor.type = 'text';
    editor.className = 'todo-editor';
    editor.value = todo.text;
    editor.maxLength = 200;
    editor.setAttribute('aria-label', 'タスクを編集');

    let finished = false;
    const finish = (value, refocus) => {
      if (finished) return;
      finished = true;
      commitEdit(todo.id, value, refocus);
    };

    editor.addEventListener('keydown', (e) => {
      // 日本語入力の変換を確定する Enter では保存しない
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Enter') finish(editor.value, true);
      else if (e.key === 'Escape') finish(null, true);
    });
    editor.addEventListener('blur', () => finish(editor.value, false));
    return editor;
  }

  function createItem(todo) {
    const li = document.createElement('li');
    li.className = 'todo-item' + (todo.done ? ' is-done' : '');
    li.dataset.id = todo.id;

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = todo.done;
    check.dataset.action = 'toggle';
    check.setAttribute('aria-label', todo.text);
    li.append(check);

    if (todo.id === editingId) {
      li.append(createEditor(todo));
    } else {
      const text = document.createElement('span');
      text.className = 'todo-text';
      text.textContent = todo.text;
      li.append(text, actionButton('edit', '編集', todo), actionButton('delete', '削除', todo));
    }
    return li;
  }

  function render() {
    // 一覧を作り直すとフォーカスが消えるので、同じ部品に戻す
    const focused = document.activeElement;
    const focusAction = list.contains(focused) ? focused.dataset.action : undefined;
    const focusId = focusAction ? idOf(focused) : null;

    const visible = todos.filter(FILTERS[filter]);
    list.replaceChildren(...visible.map(createItem));

    emptyMessage.textContent = EMPTY_MESSAGES[filter];
    emptyMessage.hidden = visible.length > 0;

    const remaining = todos.filter(FILTERS.active).length;
    count.textContent = `残り ${remaining} 件`;
    clearDone.disabled = remaining === todos.length;

    filterButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
    });

    if (focusAction) focusControl(focusId, focusAction);
  }

  function focusControl(id, action) {
    list.querySelector(`[data-id="${CSS.escape(id)}"] [data-action="${action}"]`)?.focus();
  }

  function toggle(id) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    todo.done = !todo.done;
    save();
    render();
  }

  function remove(id) {
    todos = todos.filter((t) => t.id !== id);
    save();
    render();
  }

  function startEdit(id) {
    editingId = id;
    render();
    const editor = list.querySelector('.todo-editor');
    if (editor) {
      editor.focus();
      editor.select();
    }
  }

  // value が null のときは変更を取り消す。空欄のときも元の文章を残す
  function commitEdit(id, value, refocus) {
    if (editingId === id) editingId = null;
    const text = value === null ? '' : value.trim();
    const todo = todos.find((t) => t.id === id);
    if (todo && text) {
      todo.text = text;
      save();
    }
    render();
    if (refocus) focusControl(id, 'edit');
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) {
      input.value = '';
      input.focus();
      return;
    }
    todos.push({ id: newId(), text, done: false });
    input.value = '';
    // 「完了」表示のままだと追加したタスクが見えないので、すべて表示に戻す
    if (filter === 'done') filter = 'all';
    save();
    render();
    input.focus();
  });

  list.addEventListener('change', (e) => {
    if (e.target.dataset.action === 'toggle') toggle(idOf(e.target));
  });

  list.addEventListener('click', (e) => {
    const button = e.target.closest('button[data-action]');
    if (!button) return;
    const id = idOf(button);
    if (button.dataset.action === 'edit') startEdit(id);
    else if (button.dataset.action === 'delete') remove(id);
  });

  list.addEventListener('dblclick', (e) => {
    if (e.target.matches('.todo-text')) startEdit(idOf(e.target));
  });

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      filter = button.dataset.filter;
      render();
    });
  });

  clearDone.addEventListener('click', () => {
    const doneCount = todos.filter(FILTERS.done).length;
    if (doneCount === 0) return;
    if (!confirm(`完了済みの ${doneCount} 件を削除します。元に戻せませんが、よろしいですか？`)) return;
    todos = todos.filter(FILTERS.active);
    save();
    render();
  });

  // 別のタブで変更されたときに、古い内容で上書きしないよう読み直す
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    todos = load();
    editingId = null;
    render();
  });

  render();
})();
