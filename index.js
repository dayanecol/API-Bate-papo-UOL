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

app.get("/participants", async (req,res)=>{
    try {
        const participants = await db.collection("participants").find().toArray();
        res.send(participants);
        
    } catch (error) {
        console.log("Erro ao obter os paticipantes do banco de dados!");
    }
});
app.post("/participants",async(req,res)=>{
    const user = req.body;
    const userSchema = joi.object({
        name: joi.string().required()
    });
    const validation = userSchema.validate(user);

    if (validation.error) {
        res.sendStatus(422);
        return;
    }

    try {
        const currentUser= await db.collection("participants").findOne({name:user.name});
        if(currentUser){
            res.sendStatus(409);
            return; 
        }
        await db.collection("participants").insertOne({name: user.name, lastStatus: Date.now()});
        await db.collection("messages").insertOne({from: user.name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs.format('HH:MM:SS')});
        res.sendStatus(201);
    } catch (error) {
        console.log("Erro ao validar participante!");
    }
});

app.get("/messages", async (req,res)=>{
    const limit = parseInt(req.query.limit);
    const {user} = req.headers;

    try {
        const messages = await db.collection("messages").find().toArray();
        const userMessages = messages.filter(message=>{
            const isPublic = message.type==="message" ;
            const isPrivate= message.type==="private_message";
            let isToFromUser=false;
            if (isPrivate && (message.to===user||message.from===user)){
                isToFromUser=true;
            }
            return isPublic||isToFromUser;
        });
        if((limit!==NaN)&& limit){
            res.send(userMessages.slice(-limit));
            return;
        }
    } catch (error) {
        console.log("Erro ao obter menssagens!");
    }
});

app.post("/messages",async (req,res)=>{
    const message = req.body;
    const {user} = req.headers;
    const messageSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid('message','private_message').required()
    });
    const validation = messageSchema.validate(message,{ abortEarly: false });
    if (validation.error) {
        res.sendStatus(422);
        return;
    }

    try {
        const currentUser= await db.collection("participants").findOne({name:user});
        if(!currentUser){
            res.sendStatus(422);
            return;
        }
        await db.collection("messages").insertOne({from: user, to: message.to, text: message.text, type: message.type, time: dayjs.format('HH:MM:SS')});
        res.sendStatus(201);

    } catch (error) {
        console.log("Erro ao validar usuario!");
    }
});




app.listen(PORT, ()=>{
    console.log("Servidor funcionando na porta 5000!");
});