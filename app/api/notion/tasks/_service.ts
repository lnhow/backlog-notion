import { Client } from "@notionhq/client";
import {
  BACKLOG_URL,
  BacklogWebhook,
  GVN_CATEGORY,
  REGEX_METAS,
  Task,
  TaskStatus,
  TaskStatusMapping,
  toISOStringWithoutTime,
} from "./_consts";
import {
  CreatePageParameters,
  PageObjectResponse,
  RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints";

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
      summary: BacklogService._extractString(description, REGEX_METAS.SUMMARY) || summary,
      status: BacklogService._extractTaskStatus(description),
      assignees:
        BacklogService._extractArrayString(description, REGEX_METAS.ASSIGNEE) || [
          content.assignee?.name,
        ] ||
        null,
      project: BacklogService._extractString(description, REGEX_METAS.PROJECT),
      devDueDate: BacklogService._extractTaskDevTime(description),
      releaseDueDate: BacklogService._extractTaskReleaseTime(
        startDate,
        dueDate
      ),
      parentTaskId: parentIssueId ? `${projectKey}-${parentIssueId}` : null,
      tags: BacklogService._extractArrayString(description, REGEX_METAS.TAGS),
    };
    Logger.log('Task info ========', task);
    return task;
  }

  static _extractTaskStatus(description: string) {
    const taskStatus = description.match(REGEX_METAS.STATUS);
    if (!taskStatus || taskStatus.length < 2) {
      return TaskStatus.NOT_STARTED;
    }
    const statusKey = Object.keys(TaskStatusMapping).find((key) => {
      return (
        key.localeCompare(taskStatus[1], "en", { sensitivity: "base" }) === 0
      );
    });
    return statusKey ? TaskStatusMapping[statusKey] : TaskStatus.NOT_STARTED;
  }

  static _extractTaskDevTime(description: string): Task["devDueDate"] {
    const taskDevTime = description.match(REGEX_METAS.DEV_DUE_DATE);
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
        end: new Date(dueDate).toISOString(),
      };
    }
    const start = Date.parse(dates[0]);
    const due = Date.parse(dates[1]);
    if (isNaN(start) || isNaN(due) || start > due) {
      return null;
    }
    return {
      start: toISOStringWithoutTime(start),
      end: toISOStringWithoutTime(due),
    };
  }

  static _extractTaskReleaseTime(
    startDate: BacklogWebhook["content"]["startDate"],
    dueDate: BacklogWebhook["content"]["dueDate"]
  ): Task["releaseDueDate"] {
    let start = startDate ? Date.parse(startDate) : null;
    const due = dueDate ? Date.parse(dueDate) : null;
    if (!start || isNaN(start)) {
      start = Date.now();
    }

    if (!due || isNaN(due) || start > due) {
      return null;
    }

    return {
      start: toISOStringWithoutTime(start),
      end: toISOStringWithoutTime(due),
    };
  }

  static _extractString(description: string, regex: RegExp): string | null {
    const result = description.match(regex);
    return (result && result.length > 1) ? result[1] : null;
  }

  static _extractArrayString(description: string, regex: RegExp): string[] {
    const taskTags = description.match(regex);
    if (!taskTags || taskTags.length < 2) {
      return [];
    }
    return taskTags[1].split(",").map((tag) => tag.trim());
  }
}

export class NotionService {
  private client: Client;
  private taskDBId: string;
  private projectDBId: string;
  constructor() {
    this.client = new Client({
      auth: process.env.NOTION_INTEGRATION_TOKEN,
    })
    this.taskDBId = process.env.NOTION_TASK_DB_ID || ''
    this.projectDBId = process.env.NOTION_PROJECT_DB_ID || ''
  }

  async syncTask(task: Task) {
    const [taskPage, parentTaskPage, project] = await Promise.all([
      this.getNotionPageFromTaskId(task.id),
      task.parentTaskId
        ? this.getNotionPageFromTaskId(task.parentTaskId)
        : null,
      task.project
        ? this.getNotionPageFromProjectName(task.project)
        : null,
    ]);

    const notionProps = this.taskToNotionProperties(task, {
      parentNotionPage: parentTaskPage,
      projectPage: project,
    });

    if (!taskPage) {
      await this.createTask(task, { props: notionProps });
      return;
    }

    // Update notion page
    await this.updateTask(task, { page: taskPage, props: notionProps });
  }

  async updateTask(
    task: Task,
    notion: {
      page: PageObjectResponse;
      props: CreatePageParameters["properties"];
    }
  ) {
    try {
      await this.client.pages.update({
        page_id: notion.page.id,
        properties: notion.props,
      });
      Logger.log(`Task ${task.id} updated`, notion.page.id);
    } catch (error) {
      Logger.error(error);
    }
  }

  async createTask(
    task: Task,
    notion: { props: CreatePageParameters["properties"] }
  ) {
    try {
      const res = await this.client.pages.create({
        parent: {
          database_id: this.taskDBId,
        },
        properties: notion.props,
      });
      Logger.log(`Task ${task.id} created`, res.id);
    } catch (error) {
      Logger.error(error);
    }
  }

  taskToNotionProperties(
    task: Task,
    option?: {
      parentNotionPage: PageObjectResponse | null,
      projectPage: PageObjectResponse | null,
    }
  ): CreatePageParameters["properties"] {
    return {
      "Task name": {
        type: "title",
        title: [
          {
            text: {
              content: task.name,
            },
          },
        ],
      },
      Tags: {
        type: "multi_select",
        multi_select: (task.tags ?? []).map((tag) => {
          return {
            name: tag,
          };
        }),
      },
      Priority: {
        type: "select",
        select: {
          name: task.priority,
        },
      },
      Status: {
        type: "status",
        status: {
          name: task.status,
        },
      },
      Assignees: {
        type: "multi_select",
        multi_select: (task.assignees ?? []).map((assignee) => {
          return {
            name: assignee,
          };
        }),
      },
      Summary: {
        type: "rich_text",
        rich_text: [
          {
            text: {
              content: task.summary || '',
            },
          },
        ],
      },
      "Dev Due Date": {
        type: "date",
        date: task.devDueDate,
      },
      "Release Due Date": {
        type: "date",
        date: task.releaseDueDate,
      },
      "Backlog URL": {
        type: "url",
        url: `${BACKLOG_URL}/view/` + task.id,
      },
      "Parent-task": {
        type: "relation",
        relation: option?.parentNotionPage
          ? [
              {
                id: option.parentNotionPage.id,
              },
            ]
          : [],
      },
      Project: {
        type: "relation",
        relation: option?.projectPage
          ? [
              {
                id: option.projectPage.id,
              },
            ]
          : [],
      },
    };
  }

  private async getNotionPageFromTaskId(taskId: string) {
    try {
      const notionPages = await this.client.databases.query({
        database_id: this.taskDBId,
        filter: {
          property: "Task name",
          title: {
            starts_with: taskId,
          },
        },
      });

      if (notionPages.results.length < 1) {
        return null;
      }

      const taskPage =
        notionPages.results.find((page) =>
          (
            (page as PageObjectResponse).properties["Task name"] as {
              type: "title";
              title: Array<RichTextItemResponse>;
              id: string;
            }
          ).title[0].plain_text.startsWith(taskId)
        ) || null;

      return taskPage as PageObjectResponse | null;
    } catch (error) {
      Logger.error(error);
      return null;
    }
  }

  private async getNotionPageFromProjectName(projectName: string) {
    try {
      const notionPages = await this.client.databases.query({
        database_id: this.projectDBId,
        filter: {
          property: "Project name",
          title: {
            contains: projectName,
          },
        },
      });

      if (notionPages.results.length < 1) {
        return null;
      }

      const projectPage =
        notionPages.results.find((page) =>
          (
            (page as PageObjectResponse).properties["Project name"] as {
              type: "title";
              title: Array<RichTextItemResponse>;
              id: string;
            }
          ).title[0].plain_text.includes(projectName)
        ) || null;

      return projectPage as PageObjectResponse | null;
    } catch (error) {
      Logger.error(error);
      return null;
    }
  }
}

export class Logger {
  static log(message?: any, ...optionalParams: any[]) {
    console.log("\x1b[32m[LOG]\x1b[0m", message, ...optionalParams);
  }
  static error(message?: any, ...optionalParams: any[]) {
    console.error("\x1b[32m[ERR]\x1b[0m", message, ...optionalParams);
  }
}
