import {Prop, Schema, SchemaFactory} from "@nestjs/mongoose"
import { HydratedDocument, Types } from 'mongoose'
import { User } from '../../users/schemas/user.schema'

export type MessageDocument = HydratedDocument<Message>

export interface PopulatedMessage extends Omit<Message, 'sender'> {
    _id: Types.ObjectId
    sender: {
        _id: Types.ObjectId
        name: string
    }
    createdAt: Date
    updatedAt: Date
}

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