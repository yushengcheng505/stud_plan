export type Priority = "low" | "medium" | "high";

export type Task = {
  id: string;
  title: string;
  subject: string;
  description: string;
  deadline: string;
  priority: Priority;
  completed: boolean;
};

export const STORAGE_KEY = "studplan.tasks.v1";
export const priorities: Record<Priority, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
};

export function dateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && dateKey(date) === value;
}

export function daysUntil(deadline: string, today: string): number {
  return Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
}

export function deadlineLabel(deadline: string, today: string): string {
  const days = daysUntil(deadline, today);
  if (days < 0) return "Просрочено";
  if (days === 0) return "Сегодня";
  if (days === 1) return "Завтра";
  const ending = days % 10 === 1 && days % 100 !== 11 ? "день" : [2, 3, 4].includes(days % 10) && ![12, 13, 14].includes(days % 100) ? "дня" : "дней";
  return `Через ${days} ${ending}`;
}

export function formatDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

export function readTasks(value: string): Task[] {
  const tasks: unknown = JSON.parse(value);
  if (!Array.isArray(tasks) || !tasks.every((task) =>
    task && typeof task === "object" &&
    typeof task.id === "string" && typeof task.title === "string" &&
    typeof task.subject === "string" && typeof task.description === "string" &&
    typeof task.deadline === "string" && isValidDate(task.deadline) &&
    Object.hasOwn(priorities, task.priority) && typeof task.completed === "boolean"
  ) || new Set(tasks.map((task) => task.id)).size !== tasks.length) {
    throw new Error("Некорректные данные заданий");
  }
  return tasks;
}

export function demoTasks(): Task[] {
  const deadline = (offset: number) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return dateKey(date);
  };

  return [
    { id: "demo-1", title: "Лабораторная №3 по программированию", subject: "Программирование", description: "Реализовать алгоритмы сортировки и подготовить отчёт.", deadline: deadline(1), priority: "high", completed: false },
    { id: "demo-2", title: "Контрольная по математике", subject: "Высшая математика", description: "Повторить производные и решить задания из практикума.", deadline: deadline(3), priority: "high", completed: false },
    { id: "demo-3", title: "Конспект по архитектуре ЭВМ", subject: "Архитектура ЭВМ", description: "Основные компоненты процессора и организация памяти.", deadline: deadline(5), priority: "medium", completed: false },
    { id: "demo-4", title: "Лабораторная по ОС", subject: "Операционные системы", description: "Работа с процессами и командами терминала.", deadline: deadline(-1), priority: "medium", completed: true },
    { id: "demo-5", title: "Подготовка презентации", subject: "Иностранный язык", description: "Подготовить короткую презентацию о выбранной профессии.", deadline: deadline(9), priority: "low", completed: false },
  ];
}
