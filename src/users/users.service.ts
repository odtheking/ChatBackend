import { Injectable, BadRequestException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import {Model, Types} from 'mongoose'
import { User, UserDocument } from './schemas/user.schema'
import { hash, genSalt } from "bcrypt"

@Injectable()
export class UsersService {
    constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

    async create(name: string, email: string, password: string): Promise<User> {
        const existingUser = await this.userModel.findOne({$or: [{ email }, { name }]}).exec()

        if (existingUser) {
            if (existingUser.email === email) throw new BadRequestException('User with this email already exists')
            else if (existingUser.name === name) throw new BadRequestException('User with this name already exists')
        }

        const passwordHash = await hash(password, await genSalt())

        const createdUser = new this.userModel({ name, email, passwordHash })
        return createdUser.save()
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.userModel.findOne({ email: { $regex: `^${email}$`, $options: 'i' } }).exec()
    }

    async findByName(name: string): Promise<User | null> {
        return this.userModel.findOne({ name: { $regex: `^${name}$`, $options: 'i' } }).exec()
    }

    async findById(id: Types.ObjectId): Promise<User | null> {
        return this.userModel.findById(id).exec()
    }

    async findAll(): Promise<User[]> {
        return this.userModel.find().exec()
    }
}
