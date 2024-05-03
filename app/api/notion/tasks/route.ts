import { BacklogService, NotionService } from "./_service";

export const dynamic = "force-dynamic";

const notionService = new NotionService()

export async function POST(req: Request) {
  const reqBody = await req.json()
  try {
    const isNotSkipWebhook = BacklogService.validate(reqBody)
    if (!isNotSkipWebhook) {
      return Response.json({ message: "Skipped" })
    }
    const taskInfo = BacklogService.extractTaskInfo(reqBody)
    
    notionService.syncTask(taskInfo) 
  }
  catch (e) {
    return Response.json({ message: 'Bad Request' }, { status: 400 })
  }
  return Response.json({ message: "OK" })
}
