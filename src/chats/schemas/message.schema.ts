import {Prop, Schema, SchemaFactory} from "@nestjs/mongoose"
import { HydratedDocument, Types } from 'mongoose'

export type MessageDocument = HydratedDocument<Message>

@Schema({ timestamps: true })
export class Message {

    @Prop({ type: Types.ObjectId, ref: 'Chat', required: true })
    chat: Types.ObjectId

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    sender: Types.ObjectId

    @Prop({ required: true })
    content: string
}

export const MessageSchema = SchemaFactory.createForClass(Message)