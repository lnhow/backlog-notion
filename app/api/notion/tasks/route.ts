import { BacklogService, NotionService } from "./_service";

export const dynamic = "force-dynamic";

const notionService = new NotionService()

export async function POST(req: Request) {
  const reqBody = await req.json()
  try {
    const isNotSkipWebhook = BacklogService.validate(reqBody)
    if (!isNotSkipWebhook) {
      console.log("Skipped")
      return Response.json({ message: "Skipped" })
    }
    console.log('[Dev Log] -> NotionService -> extractInfo -> webhook:', reqBody)
    const taskInfo = BacklogService.extractTaskInfo(reqBody)
    
    console.log('[Dev Log] -> NotionService -> extractInfo -> taskInfo:', taskInfo)
    notionService.syncTask(taskInfo) 
  }
  catch (e) {
    console.error('Bad request', e)
    return Response.json({ message: 'Bad Request' }, { status: 400 })
  }
  return Response.json({ message: "OK" })
}
