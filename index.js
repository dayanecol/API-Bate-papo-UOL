import express,{json} from "express";
import dotenv from "dotenv";
import cors from "cors";
import { MongoClient } from "mongodb";
import joi from "joi";
import dayjs from "dayjs";


const app = express();

app.use(cors());
app.use(json())
dotenv.config();
const PORT = process.env.PORT;
let db;
const mongoClient = new MongoClient(process.env.MONGO_URI);
const promise = mongoClient.connect();
promise
    .then(()=>{
        db = mongoClient.db("test");
        console.log("Conectou ao banco!")
    })
    .catch((error)=>{
        console.log("Erro ao conectar ao banco de dados!");
});

app.get("/participants",(req,res)=>{});
app.post("/participants",async(req,res)=>{
    const user = req.body;
    const userSchema = joi.object({
        name: joi.string().required()
    });
    const validation = userSchema.validate(user, { abortEarly: true });

    if (validation.error) {
        res.sendStatus(422);
        return;
    }

    try {
        if(await db.collection("participants").findOne({name:user.name})){
            res.sendStatus(409);
            return; 
        }
        await db.collection("participants").insertOne({name: user.name, lastStatus: Date.now()})
        await db.collection("messages").insertOne({from: user.name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs.format('HH:MM:SS')});
        res.sendStatus(201);
    } catch (error) {
        console.log("Erro ao validar participante!");
    }
});




app.listen(PORT, ()=>{
    console.log("Servidor funcionando na porta 5000!");
});