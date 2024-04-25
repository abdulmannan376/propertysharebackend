require("dotenv").config()
const express = require("express")
const cors = require("cors")
const app = express()
const port = process.env.PORT || 5000
const userRoutes = require("./routes/UserRoutes")
const propertyRoutes = require("./routes/PropertyRoutes")

app.use(cors())
app.use(express.json())

require("./middleware/dbConnect")

app.use("/user", userRoutes)
app.use("/property", propertyRoutes)


app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})
