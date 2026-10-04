import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

app.get('/ping', (_req, res) => res.json({ ok: true, message: 'API active' }))

const PORT = Number(process.env.PORT ?? 4000)
app.listen(PORT, () => console.log(`Server listening on ${PORT}`))
