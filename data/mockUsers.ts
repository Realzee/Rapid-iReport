import { Profile, Company, UserRole, UserStatus } from '../types';

export const mockCompanies: Company[] = [
  { id: 'c1', name: 'Rapid Response Inc.' },
  { id: 'c2', name: 'Community Watch Group' },
  { id: 'c3', name: 'Metro Security' },
];

export const mockUsers: Profile[] = [
  {
    id: 'u1',
    full_name: 'Admin User',
    email: 'admin@rapidireport.com',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    avatar_url: 'https://i.pravatar.cc/150?u=u1',
  },
  {
    id: 'u2',
    full_name: 'John Moderator',
    email: 'moderator.john@rr.inc',
    role: UserRole.MODERATOR,
    status: UserStatus.ACTIVE,
    company_id: 'c1',
    avatar_url: 'https://i.pravatar.cc/150?u=u2',
  },
  {
    id: 'u3',
    full_name: 'Jane Controller',
    email: 'controller.jane@rr.inc',
    role: UserRole.CONTROLLER,
    status: UserStatus.ACTIVE,
    company_id: 'c1',
    avatar_url: 'https://i.pravatar.cc/150?u=u3',
  },
  {
    id: 'u4',
    full_name: 'Mike Responder',
    email: 'responder.mike@cwg.org',
    role: UserRole.RESPONDER,
    status: UserStatus.PENDING,
    company_id: 'c2',
    avatar_url: 'https://i.pravatar.cc/150?u=u4',
  },
  {
    id: 'u5',
    full_name: 'Sarah User',
    email: 'sarah.c@email.com',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    avatar_url: 'https://i.pravatar.cc/150?u=u5',
  },
  {
    id: 'u6',
    full_name: 'David Kimani',
    email: 'david.k@metrosec.com',
    role: UserRole.RESPONDER,
    status: UserStatus.SUSPENDED,
    company_id: 'c3',
    avatar_url: 'https://i.pravatar.cc/150?u=u6',
  },
  {
    id: 'u7',
    full_name: 'Emily Otieno',
    email: 'emily.o@community.net',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    avatar_url: 'https://i.pravatar.cc/150?u=u7',
  },
];
