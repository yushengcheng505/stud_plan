"use client";

import { useEffect, useReducer, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowDownIcon, ArrowRightIcon, ArrowUpIcon, CalendarIcon, CheckIcon,
  CheckCircledIcon, ChevronDownIcon, ClockIcon, Cross2Icon, FileTextIcon,
  ListBulletIcon, Pencil1Icon, PlusIcon, ReaderIcon, TrashIcon,
} from "@radix-ui/react-icons";
import { dateKey, daysUntil, deadlineLabel, demoTasks, formatDate, isValidDate, priorities, readTasks, STORAGE_KEY, type Priority, type Task } from "./tasks";

type Filter = "all" | "active" | "completed";
type State = { tasks: Task[]; ready: boolean; error: string; today: string };
type Action = { type: "load"; tasks: Task[]; error: string } | { type: "update"; tasks: Task[]; error: string } | { type: "date" };

function reducer(state: State, action: Action): State {
  if (action.type === "date") return { ...state, today: dateKey() };
  return { ...state, tasks: action.tasks, error: action.error, ready: true, today: dateKey() };
}

function Modal({ title, subtitle, children, onClose }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const opener = document.activeElement;
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>("input, .secondary-button")?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previous;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  return (
    <dialog ref={ref} className="task-dialog" aria-labelledby="dialog-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
      <div className="flex items-start justify-between gap-4">
        <div><h2 id="dialog-title" className="text-xl font-semibold tracking-tight">{title}</h2>{subtitle && <p className="mt-2 text-sm leading-6 text-muted">{subtitle}</p>}</div>
        <button type="button" onClick={onClose} className="icon-button shrink-0" aria-label="Закрыть окно"><Cross2Icon /></button>
      </div>
      {children}
    </dialog>
  );
}

function TaskForm({ task, onSave, onClose }: { task: Task | null; onSave: (task: Task) => void; onClose: () => void }) {
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    const subject = String(data.get("subject") ?? "").trim();
    const deadline = String(data.get("deadline") ?? "");
    if (!title || !subject || !isValidDate(deadline)) {
      setError("Укажите название, дисциплину и корректную дату дедлайна.");
      return;
    }
    onSave({ id: task?.id ?? crypto.randomUUID(), title, subject, deadline, description: String(data.get("description") ?? "").trim(), priority: data.get("priority") as Priority, completed: task?.completed ?? false });
  }

  return (
    <Modal title={task ? "Изменить задание" : "Новое задание"} subtitle="Запишите важное сейчас — и ничего не забудется." onClose={onClose}>
      <form className="mt-6 grid gap-5" onSubmit={submit}>
        <label className="form-field">Название задания <input name="title" placeholder="Например, лабораторная №4" defaultValue={task?.title} required maxLength={140} autoFocus /></label>
        <label className="form-field">Дисциплина <input name="subject" placeholder="Например, программирование" defaultValue={task?.subject} required maxLength={80} /></label>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className="form-field">Дата дедлайна <input name="deadline" type="date" defaultValue={task?.deadline ?? dateKey()} required min="0001-01-01" max="9999-12-31" /></label>
          <label className="form-field">Приоритет <select name="priority" defaultValue={task?.priority ?? "medium"}>{Object.entries(priorities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <label className="form-field">Описание <span className="-mt-1 text-xs font-normal text-muted">Необязательно — детали, ссылки или заметки</span><textarea name="description" placeholder="Что нужно сделать?" rows={3} defaultValue={task?.description} maxLength={2000} /></label>
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        <div className="flex justify-end gap-3 border-t border-line pt-5"><button type="button" className="secondary-button" onClick={onClose}>Отмена</button><button className="primary-button" type="submit">{task ? "Сохранить изменения" : "Добавить задание"}</button></div>
      </form>
    </Modal>
  );
}

export default function Home() {
  const [state, dispatch] = useReducer(reducer, { tasks: [], ready: false, error: "", today: "" });
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState("asc");
  const [form, setForm] = useState<{ task: Task | null } | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [notice, setNotice] = useState("");
  const { tasks, ready, today } = state;

  useEffect(() => {
    let initial: Task[] = [];
    let error = "";
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      initial = saved === null ? demoTasks() : readTasks(saved);
      if (saved === null) localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    } catch {
      error = "Не удалось прочитать или сохранить задания в браузере. Проверьте доступ к хранилищу. Повреждённые данные не перезаписаны.";
    }
    dispatch({ type: "load", tasks: initial, error });
    const refreshDate = () => dispatch({ type: "date" });
    const timer = window.setInterval(refreshDate, 60000);
    window.addEventListener("focus", refreshDate);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refreshDate); };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function updateTasks(next: Task[], message: string) {
    let error = "";
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch { error = "Изменения видны на странице, но не сохранены. Хранилище браузера недоступно или заполнено; не закрывайте страницу."; }
    dispatch({ type: "update", tasks: next, error });
    setNotice(error ? "" : message);
  }

  function toggleTask(task: Task) {
    updateTasks(tasks.map((item) => item.id === task.id ? { ...item, completed: !item.completed } : item), task.completed ? "Задание снова активно" : "Задание выполнено. Отличная работа!");
  }

  const active = tasks.filter((task) => !task.completed);
  const completed = tasks.length - active.length;
  const upcoming = active.filter((task) => daysUntil(task.deadline, today) >= 0).sort((a, b) => a.deadline.localeCompare(b.deadline));
  const thisWeek = upcoming.filter((task) => daysUntil(task.deadline, today) <= 7);
  const overdue = active.filter((task) => task.deadline < today).length;
  const visible = tasks.filter((task) => filter === "all" || (filter === "completed" ? task.completed : !task.completed)).sort((a, b) => (sort === "asc" ? 1 : -1) * a.deadline.localeCompare(b.deadline));
  const filters: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "Все", count: tasks.length }, { value: "active", label: "Активные", count: active.length }, { value: "completed", label: "Выполненные", count: completed },
  ];
  const progress = tasks.length ? Math.round(completed / tasks.length * 100) : 0;

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-white"><ReaderIcon className="size-6" /></span>
            <div><div className="text-xl font-bold tracking-tight">Студ<span className="text-accent">План</span></div><p className="mt-0.5 text-xs text-muted">Учебные задачи под контролем</p></div>
          </div>
          <span className="hidden items-center gap-2 text-xs text-muted sm:flex"><span className="size-1.5 rounded-full bg-accent" />Твой личный учебный планировщик</span>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-5 pb-12 pt-9 sm:px-8 sm:pt-11">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div><div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Меньше хаоса. Больше порядка.</div><h1 className="text-[29px] font-semibold leading-tight tracking-tight sm:text-[34px]">Всё успеется.</h1><p className="mt-2 text-sm leading-6 text-muted">Задания, дедлайны и немного спокойствия — в одном месте.</p></div>
          <div className="flex items-center gap-2.5 rounded-lg border border-line bg-white px-3.5 py-2.5 text-xs text-muted"><CalendarIcon className="size-4 text-accent" /><span>{ready ? new Date(`${today}T12:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) : "Сегодня"}</span></div>
        </div>

        <section aria-label="Обзор заданий" className="mb-9 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="stat-card"><div className="flex items-center justify-between"><span className="text-sm font-medium text-muted">Активные задания</span><span className="stat-icon"><ListBulletIcon /></span></div><div className="mt-3 flex items-baseline gap-3"><strong className="text-[34px] font-semibold leading-none tracking-tight">{ready ? active.length : "—"}</strong><span className="text-xs text-muted">в твоём списке</span></div><p className="mt-4 text-xs text-muted">{overdue ? `${overdue} с истёкшим дедлайном` : "Шаг за шагом — к результату"}</p></div>
          <div className="stat-card"><div className="flex items-center justify-between"><span className="text-sm font-medium text-muted">Выполнено</span><span className="stat-icon"><CheckCircledIcon /></span></div><div className="mt-3 flex items-baseline gap-3"><strong className="text-[34px] font-semibold leading-none tracking-tight">{ready ? completed : "—"}</strong><span className="text-xs text-muted">{ready && tasks.length ? `из ${tasks.length} заданий` : "заданий"}</span></div><div className="mt-4 flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} /></div><span className="text-[11px] text-muted">{progress}%</span></div></div>
          <div className="stat-card border-accent/20 bg-accent-soft"><div className="flex items-center justify-between"><span className="text-sm font-medium text-accent">Ближайшие дедлайны</span><span className="stat-icon bg-white/75"><ClockIcon /></span></div><div className="mt-3 flex items-baseline gap-3"><strong className="text-[34px] font-semibold leading-none tracking-tight">{ready ? thisWeek.length : "—"}</strong><span className="text-xs text-muted">в ближайшие 7 дней</span></div><p className="mt-4 text-xs text-muted">{thisWeek.length ? "Самое важное — не откладывать" : "Можно планировать без спешки"}</p></div>
        </section>

        {state.error && <p role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">{state.error}</p>}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_292px]">
          <section aria-labelledby="tasks-heading" className="min-w-0">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-2.5"><h2 id="tasks-heading" className="text-xl font-semibold tracking-tight">Мои задания</h2><span className="rounded-md bg-white px-2 py-0.5 text-xs text-muted ring-1 ring-line">{ready ? tasks.length : "—"}</span></div><button className="primary-button" disabled={!ready} onClick={() => setForm({ task: null })}><PlusIcon className="size-4" />Добавить задание</button></div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex rounded-lg border border-line bg-white p-1" aria-label="Фильтры заданий">{filters.map((item) => <button key={item.value} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)} className={`filter-button ${filter === item.value ? "filter-selected" : ""}`}>{item.label}<span className="hidden text-[10px] opacity-75 xl:inline">{ready ? item.count : "—"}</span></button>)}</div>
              <label className="flex items-center gap-1.5 text-xs text-muted">{sort === "asc" ? <ArrowDownIcon /> : <ArrowUpIcon />}<span className="sr-only">Сортировка по дедлайну</span><select aria-label="Сортировка по дедлайну" className="sort-select" value={sort} onChange={(event) => setSort(event.target.value)}><option value="asc">Сначала ближайшие</option><option value="desc">Сначала дальние</option></select><ChevronDownIcon className="pointer-events-none -ml-5" /></label>
            </div>

            <div className="grid gap-3" aria-busy={!ready}>
              {!ready && [1, 2, 3].map((item) => <div key={item} className="h-40 rounded-xl border border-line bg-white p-5"><div className="h-4 w-2/3 rounded bg-soft" /><div className="mt-4 h-3 w-1/3 rounded bg-soft" /><div className="mt-9 h-7 w-24 rounded bg-soft" /></div>)}
              {ready && visible.map((task) => (
                <article key={task.id} data-task-id={task.id} data-deadline={task.deadline} className={`task-card ${task.completed ? "task-completed" : ""}`}>
                  <div className="flex items-start gap-3.5">
                    <button className={`task-checkbox mt-0.5 shrink-0 ${task.completed ? "checked" : ""}`} aria-label={`${task.completed ? "Вернуть в активные" : "Выполнить"}: ${task.title}`} aria-pressed={task.completed} onClick={() => toggleTask(task)}>{task.completed && <CheckIcon className="size-3.5" />}</button>
                    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className={`task-title text-[14px] font-semibold leading-6 ${task.completed ? "text-muted line-through decoration-muted" : ""}`}>{task.title}</h3><span className={`priority priority-${task.priority}`}><span className="size-1 rounded-full bg-current" />{priorities[task.priority]}</span></div><div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted"><span>{task.subject}</span><span aria-hidden="true">•</span><span className="inline-flex items-center gap-1"><CalendarIcon className="size-3" /><time dateTime={task.deadline}>{formatDate(task.deadline)}</time></span></div>{task.description && <p className="mt-2.5 whitespace-pre-wrap break-words text-xs leading-5 text-muted">{task.description}</p>}</div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${task.completed ? "text-muted" : daysUntil(task.deadline, today) <= 1 ? "text-red-700" : "text-muted"}`}>{task.completed ? <CheckCircledIcon className="size-3.5" /> : <ClockIcon className="size-3.5" />}{task.completed ? "Выполнено" : deadlineLabel(task.deadline, today)}</span>
                    <div className="flex items-center gap-1"><button onClick={() => toggleTask(task)} className={`task-action ${task.completed ? "text-muted" : "text-accent"}`}><CheckIcon />{task.completed ? "Вернуть" : "Выполнить"}</button><button className="task-action text-muted" onClick={() => setForm({ task })}><Pencil1Icon />Изменить</button><button className="icon-button delete-button" aria-label={`Удалить: ${task.title}`} title="Удалить задание" onClick={() => setDeleting(task)}><TrashIcon /></button></div>
                  </div>
                </article>
              ))}
              {ready && visible.length === 0 && <div className="rounded-xl border border-dashed border-line bg-white px-5 py-14 text-center"><span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-accent-soft text-accent"><FileTextIcon className="size-6" /></span><h3 className="font-semibold">{filter === "completed" ? "Пока нет выполненных заданий" : filter === "active" && tasks.length ? "Все задания выполнены!" : "Здесь будет твой учебный план"}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">{filter === "completed" ? "Отметьте готовую работу — она появится здесь." : "Добавьте новое задание, чтобы держать дедлайны под контролем."}</p>{filter !== "completed" && <button className="secondary-button mx-auto mt-5" onClick={() => setForm({ task: null })}><PlusIcon />Добавить задание</button>}</div>}
            </div>
            {ready && visible.length > 0 && <p className="mt-4 text-center text-[11px] text-muted">Показано {visible.length} из {tasks.length} заданий</p>}
          </section>

          <aside className="grid gap-4 lg:pt-0" aria-label="Ближайшие дедлайны">
            <section className="rounded-xl border border-line bg-white p-5">
              <div className="flex items-center gap-2"><CalendarIcon className="size-4 text-accent" /><h2 className="text-sm font-semibold">На горизонте</h2></div><p className="mt-1.5 text-xs text-muted">Ближайшие задания, о которых стоит помнить</p>
              <div className="mt-5 grid gap-5">{upcoming.slice(0, 3).map((task) => <div key={task.id} className="flex items-start gap-3"><div className="flex w-10 shrink-0 flex-col items-center rounded-lg border border-line bg-background py-1.5"><span className="text-base font-semibold leading-5">{Number(task.deadline.slice(-2))}</span><span className="mt-0.5 text-[9px] uppercase text-muted">{new Date(`${task.deadline}T12:00:00`).toLocaleDateString("ru-RU", { month: "short" }).replace(".", "")}</span></div><div className="min-w-0"><h3 className="break-words text-xs font-medium leading-5">{task.title}</h3><p className="mt-0.5 break-words text-[10px] leading-4 text-muted">{task.subject}</p><span className={`mt-1 inline-block text-[10px] font-medium ${daysUntil(task.deadline, today) <= 1 ? "text-red-700" : "text-accent"}`}>{deadlineLabel(task.deadline, today)}</span></div></div>)}{ready && !upcoming.length && <p className="text-xs leading-6 text-muted">Предстоящих дедлайнов нет.{overdue > 0 ? " Проверьте просроченные задания в списке." : " Самое время выдохнуть."}</p>}{!ready && <div className="h-24 rounded-lg bg-soft" />}</div>
              {upcoming.length > 3 && <button className="mt-5 flex w-full items-center justify-between border-t border-line pt-4 text-xs font-medium text-accent" onClick={() => { setFilter("active"); setSort("asc"); document.getElementById("tasks-heading")?.scrollIntoView({ block: "start" }); }}>Все активные задания<ArrowRightIcon /></button>}
            </section>
            <section className="rounded-xl border border-accent/15 bg-accent-soft p-5"><span className="mb-3 flex size-8 items-center justify-center rounded-lg bg-white text-accent"><ReaderIcon className="size-4" /></span><h2 className="text-sm font-semibold">Большие цели — маленькими шагами</h2><p className="mt-2 text-xs leading-6 text-muted">Начните с одного задания. Отметьте его выполненным. Повторите. Вы справитесь.</p><div className="mt-4 h-px bg-accent/10" /><p className="mt-3 text-[10px] font-medium text-accent">Ваш темп. Ваш план.</p></section>
            <p className="px-2 text-center text-[10px] leading-5 text-muted">Данные хранятся только в этом браузере.<br />Без регистрации и лишних сложностей.</p>
          </aside>
        </div>
      </main>
      <footer className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-5 text-[10px] text-muted sm:px-8"><span className="font-semibold">СтудПлан <span className="ml-2 font-normal">Сделано студентами для студентов</span></span><span>Учебный проект · Всё начинается с плана</span></footer>
      <div role="status" aria-live="polite" className={`save-notice ${notice ? "visible" : ""}`}>{notice && <><CheckCircledIcon className="size-4 shrink-0" />{notice}</>}</div>

      {form && <TaskForm task={form.task} onClose={() => setForm(null)} onSave={(task) => { updateTasks(form.task ? tasks.map((item) => item.id === task.id ? task : item) : [...tasks, task], form.task ? "Изменения сохранены" : "Задание добавлено"); setForm(null); }} />}
      {deleting && <Modal title="Удалить задание?" onClose={() => setDeleting(null)}><p className="mt-4 break-words text-sm leading-6 text-muted">«{deleting.title}» будет удалено. Это действие нельзя отменить.</p><div className="mt-6 flex justify-end gap-3"><button className="secondary-button" autoFocus onClick={() => setDeleting(null)}>Отмена</button><button className="danger-button" onClick={() => { updateTasks(tasks.filter((task) => task.id !== deleting.id), "Задание удалено"); setDeleting(null); }}>Удалить задание</button></div></Modal>}
    </div>
  );
}
