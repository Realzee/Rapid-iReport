import React from 'react';
import { Notification } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { UserIcon, ZapIcon, CheckCircleIcon } from './icons';

interface NotificationsPanelProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClose: () => void;
}

const NotificationIcon: React.FC<{ type: string }> = ({ type }) => {
    switch (type) {
        case 'new_report':
            return <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center"><ZapIcon className="w-5 h-5 text-blue-500" /></div>;
        case 'new_user':
            return <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center"><UserIcon className="w-5 h-5 text-green-500" /></div>;
        case 'new_registration_request':
            return <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center"><UserIcon className="w-5 h-5 text-purple-500" /></div>;
        default:
            return <div className="w-8 h-8 rounded-full bg-gray-500/10 flex items-center justify-center"><CheckCircleIcon className="w-5 h-5 text-gray-500" /></div>;
    }
};

const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ notifications, onMarkAsRead, onMarkAllAsRead, onClose }) => {
  return (
    <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white/90 dark:bg-gray-800/80 backdrop-blur-lg rounded-xl shadow-lg ring-1 ring-black/5 dark:ring-white/10 py-2 flex flex-col max-h-[70vh]">
      <div className="px-4 py-2 flex justify-between items-center border-b border-gray-200 dark:border-gray-700/50">
        <h3 className="font-bold text-lg text-gray-900 dark:text-white">Notifications</h3>
        <button onClick={onMarkAllAsRead} className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50" disabled={notifications.every(n => n.is_read)}>
          Mark all as read
        </button>
      </div>
      
      <div className="flex-grow overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-500 dark:text-gray-400">You have no new notifications.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700/50">
            {notifications.map(notification => (
              <li 
                key={notification.id} 
                className={`flex items-start gap-4 p-4 transition-colors cursor-pointer ${notification.is_read ? '' : 'bg-blue-500/5 dark:bg-blue-500/10'} hover:bg-gray-100 dark:hover:bg-gray-700/50`}
                onClick={() => !notification.is_read && onMarkAsRead(notification.id)}
              >
                {!notification.is_read && <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-2.5 flex-shrink-0"></div>}
                <div className={`flex-shrink-0 ${notification.is_read ? 'ml-[26px]' : ''}`}>
                  <NotificationIcon type={notification.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800 dark:text-gray-100 truncate">{notification.title}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 break-words">{notification.message}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default NotificationsPanel;