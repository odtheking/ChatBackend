import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { compare } from 'bcrypt'
import { UsersService } from '../users/users.service'
import {User} from "../users/schemas/user.schema"

@Injectable()
export class AuthService {
    constructor(private usersService: UsersService, private jwtService: JwtService) {}

    async checkUser(email: string, password: string): Promise<User> {
        const user = await this.usersService.findByEmail(email)
        if (!user) throw new UnauthorizedException('Incorrect email or password')

        if (!await compare(password, user.passwordHash)) throw new UnauthorizedException('Incorrect email or password')

        return user
    }

    async login(email: string, password: string) {
        const user = await this.checkUser(email, password)
        const accessToken = this.jwtService.sign({ sub: user._id, username: user.name })

        return { accessToken }
    }
}
