import {
  BacklogWebhook,
  GVN_CATEGORY,
  Task,
  TaskStatus,
  TaskStatusMapping,
} from "./_consts";

export class BacklogService {
  constructor() {}

  static validate(webhook: BacklogWebhook) {
    if (!webhook || !webhook.content || !webhook.content.category) {
      throw new Error("Invalid request body");
    }
    const isNotSkipWebhook =
      webhook.content.category.some((el: { name: string }) => {
        return el.name === GVN_CATEGORY;
      }) &&
      webhook.project &&
      webhook.project.projectKey;

    return isNotSkipWebhook;
  }

  static extractTaskInfo(webhook: BacklogWebhook) {
    const { project, content } = webhook;
    const { projectKey } = project;
    const {
      key_id,
      summary,
      description,
      parentIssueId,
      startDate,
      dueDate,
      priority,
    } = content;

    const taskId = `${projectKey}-${key_id}`;
    const task: Task = {
      id: taskId,
      name: taskId + " " + summary,
      priority: priority.name,
      status: BacklogService._extractTaskStatus(description),
      assignees:
        BacklogService._extractTaskAssignee(description) || [
          content.assignee?.name,
        ] ||
        null,
      project: BacklogService._extractTaskProject(description),
      devDueDate: BacklogService._extractTaskDevTime(description),
      releaseDueDate: BacklogService._extractTaskReleaseTime(
        startDate,
        dueDate
      ),
      parentTaskId: parentIssueId ? `${projectKey}-${parentIssueId}` : null,
      tags: BacklogService._extractTags(description),
    };
    return task;
  }

  static _extractTaskStatus(description: string) {
    const taskStatus = description.match(/!Status: (.*)/);
    if (
      !taskStatus ||
      taskStatus.length < 2 ||
      TaskStatusMapping[taskStatus[1]] === undefined
    ) {
      return TaskStatus.NOT_STARTED;
    }
    return TaskStatusMapping[taskStatus[1]];
  }

  static _extractTaskDevTime(description: string) {
    const taskDevTime = description.match(/!Dev: (.*)/);
    if (!taskDevTime || taskDevTime.length < 2) {
      return null;
    }
    const dates = taskDevTime[1].split("-").map((date) => date.trim());
    if (dates.length < 2) {
      const dueDate = Date.parse(dates[0]);
      if (isNaN(dueDate)) {
        return null;
      }
      return {
        start: new Date().toISOString(),
        due: new Date(dueDate).toISOString(),
      };
    }
    const startDate = Date.parse(dates[0]);
    const dueDate = Date.parse(dates[1]);
    if (isNaN(startDate) || isNaN(dueDate) || startDate > dueDate) {
      return null;
    }
    return {
      start: new Date(startDate).toISOString(),
      due: new Date(dueDate).toISOString(),
    };
  }

  static _extractTaskAssignee(description: string) {
    const assignees = description.match(/!Assignee: (.*)/);
    if (!assignees || assignees.length < 2) {
      return [];
    }
    return assignees[1].split(",").map((assignee) => assignee.trim());
  }

  static _extractTags(description: string) {
    const taskTags = description.match(/!Tags: (.*)/);
    if (!taskTags || taskTags.length < 2) {
      return [];
    }
    return taskTags[1].split(",").map((tag) => tag.trim());
  }

  static _extractTaskProject(description: string) {
    const taskProject = description.match(/!Project: (.*)/);
    if (!taskProject || taskProject.length < 2) {
      return null;
    }
    return taskProject[1];
  }

  static _extractTaskReleaseTime(
    startDate: BacklogWebhook["content"]["startDate"],
    dueDate: BacklogWebhook["content"]["dueDate"]
  ) {
    let start = startDate ? Date.parse(startDate) : null;
    const due = dueDate ? Date.parse(dueDate) : null;
    if (!start || isNaN(start)) {
      start = Date.now();
    }

    if (!due || isNaN(due) || start > due) {
      return null;
    }

    return {
      start: new Date(start).toISOString(),
      due: new Date(due).toISOString(),
    };
  }
}

export class NotionService {
  constructor() {}

  async syncTask(task: Task) {
    const [taskPageId, parentTaskPageId] = await Promise.all([
      this.getNotionPageIdFromName(task.id),
      task.parentTaskId
        ? this.getNotionPageIdFromName(task.parentTaskId)
        : null,
      // TODO: Project page id
    ]);
    if (!taskPageId) {
      // Notion page not found, create new page
      return;
    }
    // Update notion page
  }

  private async getNotionPageIdFromName(taskId: string) {
    // TODO: Implement this
    return taskId;
  }
}
