import { Controller, Get, Post, Body } from '@nestjs/common'
import { UsersService } from './users.service'
import {User} from "./schemas/user.schema"

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Post("/signup")
    async create(@Body() body: { name: string, email: string, password: string }): Promise<User> {
        return this.usersService.create(body.name, body.email, body.password)
    }

    @Get()
    async findAll() {
        return this.usersService.findAll()
    }
}
