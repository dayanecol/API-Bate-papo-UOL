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
    const participant = req.body;
    const participantSchema = joi.object({
        name: joi.string().required()
    });
    const validation = participantSchema.validate(participant);

    if (validation.error) {
        res.sendStatus(422);
        return;
    }

    try {
        const currentUser= await db.collection("participants").findOne({name: participant.name});
        if(currentUser){
            res.sendStatus(409);
            return; 
        }
        await db.collection("participants").insertOne({name: participant.name, lastStatus: Date.now()});
        await db.collection("messages").insertOne({
            from: participant.name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: dayjs().format('HH:mm:ss')
          });
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

app.post("/messages", async (req,res)=>{
    const message = req.body;
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
    const {user} = req.headers;
    try {
        const currentUser= await db.collection("participants").findOne({ name:user });
        if(!currentUser){
            res.sendStatus(422);
            return;
        }
        const { to, text, type } = message;
        await db.collection("messages").insertOne({
        to,
        text,
        type,
        from: user,
        time: dayjs().format('HH:mm:ss')
        });
        res.sendStatus(201);

    } catch (error) {
        console.log("Erro ao validar usuario!");
    }
});

app.post("/status", async (req,res)=>{
    const {user} = req.headers;

    try {
        const participant = await db.collection("participants").find({name:user});
        if(!participant){
            res.sendStatus(404);
            return;
        }
        await db.collection("participants").updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
        res.sendStatus(200);
    } catch (error) {
        console.log("Erro no status!");
    }
});

setInterval ( async ()=>{
    const tenSecondsAgo = Date.now() - 10000;

    try {
        const lstInactives = await db.collection("participants").find({ lastStatus: { $lte: tenSecondsAgo } }).toArray();
        if(lstInactives.length>0){
           const returnToInactive = lstInactives.map (participant=>{
                return {
                    from: participant.name,
                    to: 'Todos',
                    text: 'sai da sala...',
                    type: 'status',
                    time: dayjs().format("HH:mm:ss")
                }
            });
            await db.collection("messages").insertMany(returnToInactive);
            await db.collection("participants").deleteMany({ lastStatus: { $lte: tenSecondsAgo } });
        }
    } catch (error) {
        
    }
},15000);



app.listen(PORT, ()=>{
    console.log("Servidor funcionando na porta 5000!");
});