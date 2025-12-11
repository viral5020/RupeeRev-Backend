import { IUserDocument } from '../models/user';

declare global {
  namespace Express {
    interface User extends IUserDocument { }
    interface Request {
      user?: IUserDocument;
      auth?: {
        id: string;
        roles: string[];
      };
    }
  }
}
