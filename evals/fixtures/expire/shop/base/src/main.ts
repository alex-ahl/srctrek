import { startScheduler } from "./jobs/schedule"
import { startServer } from "./server"

startServer(8080)
startScheduler()
