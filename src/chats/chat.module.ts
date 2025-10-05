import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"
import { ChatsService } from "./chat.service"
import { Chat, ChatSchema } from "./schemas/chat.schema"
import { Message, MessageSchema } from "./schemas/message.schema"
import { UsersModule } from '../users/users.module'
import { EventsGateway } from '../websocket/events.gateway'

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Chat.name, schema: ChatSchema },
            { name: Message.name, schema: MessageSchema }
        ]),
        UsersModule
    ],
    providers: [ChatsService, EventsGateway],
    controllers: [],
    exports: [ChatsService]
})
export class ChatModule {}