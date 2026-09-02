import { UserModel, type UserDocument } from "../schema/user.schema.js";

export class UserRepository {
    async findById(id: string): Promise<UserDocument | null> {
        return UserModel.findById(id).exec();
    }

    async findByIdWithPassword(id: string): Promise<UserDocument | null> {
        return UserModel.findById(id).select("+passwordHash").exec();
    }

    async findByEmail(email: string): Promise<UserDocument | null> {
        return UserModel.findOne({ email: email.toLowerCase() }).exec();
    }

    async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
        return UserModel.findOne({ email: email.toLowerCase() })
            .select("+passwordHash")
            .exec();
    }

    async findByUsername(username: string): Promise<UserDocument | null> {
        return UserModel.findOne({ username: username.toLowerCase() }).exec();
    }

    async findByEmailOrUsername(
        email: string,
        username: string,
    ): Promise<UserDocument | null> {
        return UserModel.findOne({
            $or: [
                { email: email.toLowerCase() },
                { username: username.toLowerCase() },
            ],
        }).exec();
    }

    async findByUsernameOrEmailWithPassword(
        identifier: string,
    ): Promise<UserDocument | null> {
        const lower = identifier.toLowerCase();
        return UserModel.findOne({
            $or: [{ email: lower }, { username: lower }],
        })
            .select("+passwordHash")
            .exec();
    }

    async create(data: Partial<UserDocument>): Promise<UserDocument> {
        const user = await UserModel.create(data);
        return user;
    }

    async updateById(
        id: string,
        data: Partial<UserDocument>,
    ): Promise<UserDocument | null> {
        return UserModel.findByIdAndUpdate(id, data, { new: true }).exec();
    }

    async search(
        query: string,
        limit = 10,
    ): Promise<UserDocument[]> {
        if (!query.trim()) return [];
        return UserModel.find({
            $or: [
                { username: { $regex: query, $options: "i" } },
                { displayName: { $regex: query, $options: "i" } },
            ],
        })
            .limit(limit)
            .select("-passwordHash")
            .exec();
    }

    async findAllPaginated(
        page = 1,
        limit = 20,
    ): Promise<{ users: UserDocument[]; total: number }> {
        const skip = (page - 1) * limit;
        const [users, total] = await Promise.all([
            UserModel.find().skip(skip).limit(limit).sort({ createdAt: -1 }).exec(),
            UserModel.countDocuments(),
        ]);
        return { users, total };
    }

    async existsByEmailOrUsername(
        email: string,
        username: string,
    ): Promise<boolean> {
        const exists = await UserModel.exists({
            $or: [
                { email: email.toLowerCase() },
                { username: username.toLowerCase() },
            ],
        });
        return Boolean(exists);
    }
}

export const userRepository = new UserRepository();
