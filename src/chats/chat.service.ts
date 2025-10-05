import {HttpException, HttpStatus, Injectable} from "@nestjs/common"
import {InjectModel} from "@nestjs/mongoose"
import {Chat, ChatDocument} from "./schemas/chat.schema"
import {Message, MessageDocument} from "./schemas/message.schema"
import {Model, Types} from "mongoose"
import {UsersService} from '../users/users.service'

@Injectable()
export class ChatsService {
    constructor(
        @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
        @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
        private usersService: UsersService
    ) {}

    async create(users: string[]) {
        const userIds: Types.ObjectId[] = []
        for (const name of new Set(users)) {
            const user = await this.usersService.findByName(name)
            if (!user) throw new HttpException(`${name} does not exist`, HttpStatus.BAD_REQUEST)
            userIds.push(user._id)
        }

        return new this.chatModel({ users: userIds }).save()
    }

    async findByUser(userId: Types.ObjectId) {
        return this.chatModel.find({ users: userId }).populate('users')
    }

    async findById(chatId: Types.ObjectId) {
        return this.chatModel.findById(chatId).populate('users')
    }

    async getMessages(chatId: Types.ObjectId): Promise<MessageDocument[]> {
        return this.messageModel
            .find({chat: chatId})
            .populate('sender', 'name _id')
            .sort({createdAt: 1})
            .exec()
    }

    async saveMessage(chatId: Types.ObjectId, senderId: Types.ObjectId, content: string) {
        const savedMessage = await (new this.messageModel({ chat: chatId, sender: senderId, content: content.trim() })).save()
        
        return this.messageModel
            .findById(savedMessage._id)
            .populate('sender', 'name _id')
            .exec()
    }

    async deleteChat(chatId: Types.ObjectId, userId: Types.ObjectId) {
        const chat = await this.chatModel.findById(chatId)
        if (!chat) throw new Error('Chat not found')
        if (!chat.users.some(u => u.toString() === userId.toString())) throw new Error('User is not a member of this chat')

        await this.messageModel.deleteMany({ chat: chatId })
        await this.chatModel.findByIdAndDelete(chatId)

        return chat
    }
}
