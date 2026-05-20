import { User, UserCreationAttributes } from './users.model';

export class UsersRepository {
  static async create(data: UserCreationAttributes): Promise<User> {
    return User.create(data);
  }

  static async findById(id: string): Promise<User | null> {
    return User.findByPk(id);
  }

  static async findByEmail(email: string): Promise<User | null> {
    return User.findOne({ where: { email } });
  }

  static async findAll(where: any = {}): Promise<User[]> {
    return User.findAll({ where, order: [['createdAt', 'DESC']] });
  }

  static async update(id: string, data: Partial<UserCreationAttributes>): Promise<[number]> {
    return User.update(data, { where: { id } });
  }

  static async delete(id: string): Promise<number> {
    return User.destroy({ where: { id } });
  }
}
