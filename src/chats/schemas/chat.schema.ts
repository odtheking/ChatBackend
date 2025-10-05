import {Prop, Schema, SchemaFactory} from "@nestjs/mongoose"
import { HydratedDocument, Types } from 'mongoose'

export type ChatDocument = HydratedDocument<Chat>

@Schema()
export class Chat {

    @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], required: true })
    users: Types.ObjectId[]
}

export const ChatSchema = SchemaFactory.createForClass(Chat)