export type BacklogWebhook = {
  id: number,
  project: {
    id: number,
    projectKey: string,
    name: string,
  },
  type: number,
  content: {
    id: number,
    key_id: string,
    summary: string,
    description: string,
    comment: {
      id: number,
      content: string,
    },
    parentIssueId: number | null,
    startDate: string | null,
    dueDate: string | null,
    priority: {
      id: number,
      name: string,
    },
    status: {
      id: number,
      name: string,
    },
    category: {
      id: number,
      name: string,
    }[],
    assignee: {
      id: number,
      name: string,
    } | null,
  },
}

export type Task = {
  id: string,
  name: string,
  summary: string,
  priority: string,
  status: TaskStatus,
  project: string | null,
  assignees: string[] | null,
  tags: string[] | null,
  devDueDate: { start: string, end: string | null } | null,
  releaseDueDate: { start: string, end: string | null } | null,
  parentTaskId: string | null,
}

export const GVN_CATEGORY = "GGJVN"
export const BACKLOG_URL = process.env.BACKLOG_URL

export enum TaskStatus {
  NOT_STARTED = "Not Started",
  PENDING = "Pending",
  DEPEND_JP = "Depend JP",
  IN_PROGRESS = "In Progress",
  VN_VERIFY = "VN Verify",
  JP_VERIFY = "JP Verify",
  REVIEWING = "Reviewing",
  DONE = "Done",
}

export const TaskStatusMapping: Record<string, TaskStatus> = {
  'open': TaskStatus.NOT_STARTED,
  'pending': TaskStatus.PENDING,
  'depend': TaskStatus.DEPEND_JP,
  'doing': TaskStatus.IN_PROGRESS,
  'vnverify': TaskStatus.VN_VERIFY,
  'jpverify': TaskStatus.JP_VERIFY,
  'reviewing': TaskStatus.REVIEWING,
  'done': TaskStatus.DONE,
}

export const REGEX_METAS = {
  PROJECT: /!Project: (.*)/i,
  ASSIGNEE: /!Assignee: (.*)/i,
  STATUS: /!Status: (.*)/i,
  TAGS: /!Tag: (.*)/i,
  DEV_DUE_DATE: /!Dev: (.*)/i,
  SUMMARY: /!Summary: (.*)/i,
}

export const toISOStringWithoutTime = (date: number) => {
  const isoString = new Date(date).toISOString()
  return isoString.split('T')[0]
}

