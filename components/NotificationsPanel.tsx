import React from 'react';
import { Notification, Profile } from '../types';
import { safeFormatDistanceToNow } from '../utils/dateUtils';
import { UserIcon, ZapIcon, CheckCircleIcon, ShareIcon, AlertTriangleIcon } from './icons';

interface NotificationsPanelProps {
  notifications: Notification[];
  onNotificationClick: (notification: Notification) => void;
  onMarkAllAsRead: () => void;
  onClose: () => void;
  pendingUsersCount?: number;
  pendingSharesCount?: number;
  pendingUsers?: Profile[];
  onNavigateToUsers?: () => void;
  onOpenSharing?: () => void;
  onQuickApproveUser?: (userId: string, userName: string) => void;
}

const NotificationIcon: React.FC<{ type: string }> = ({ type }) => {
    switch (type) {
        case 'new_report':
            return <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center"><ZapIcon className="w-5 h-5 text-blue-500" /></div>;
        case 'new_user':
        case 'pending_user_approval':
            return <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center"><UserIcon className="w-5 h-5 text-amber-500" /></div>;
        case 'new_registration_request':
            return <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center"><UserIcon className="w-5 h-5 text-purple-500" /></div>;
        case 'report_share_pending':
            return <div className="w-8 h-8 rounded-full bg-orange-500/15 flex items-center justify-center"><ShareIcon className="w-5 h-5 text-orange-500" /></div>;
        default:
            return <div className="w-8 h-8 rounded-full bg-gray-500/10 flex items-center justify-center"><CheckCircleIcon className="w-5 h-5 text-gray-500" /></div>;
    }
};

const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ 
  notifications, 
  onNotificationClick, 
  onMarkAllAsRead, 
  onClose,
  pendingUsersCount = 0,
  pendingSharesCount = 0,
  pendingUsers = [],
  onNavigateToUsers,
  onOpenSharing,
  onQuickApproveUser
}) => {
  const hasPendingApprovals = pendingUsersCount > 0 || pendingSharesCount > 0;

  return (
    <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10 py-2 flex flex-col max-h-[85vh] z-50 animate-fade-in-up border border-gray-200 dark:border-gray-800">
      <div className="px-4 py-2.5 flex justify-between items-center border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-base text-gray-900 dark:text-white">Alerts & Notifications</h3>
          {hasPendingApprovals && (
            <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse">
              Action Required
            </span>
          )}
        </div>
        <button onClick={onMarkAllAsRead} className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50" disabled={notifications.every(n => n.is_read)}>
          Mark all read
        </button>
      </div>

      {/* PENDING APPROVALS ALERT CARDS */}
      {hasPendingApprovals && (
        <div className="p-3 bg-amber-50/80 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/40 space-y-2">
          {pendingUsersCount > 0 && (
            <div className="p-2.5 bg-white dark:bg-gray-800 rounded-xl border border-amber-200 dark:border-amber-800 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                      {pendingUsersCount} User Registration{pendingUsersCount > 1 ? 's' : ''} Pending
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Awaiting administrator approval</p>
                  </div>
                </div>
                {onNavigateToUsers && (
                  <button
                    type="button"
                    onClick={() => {
                      onNavigateToUsers();
                      onClose();
                    }}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors cursor-pointer flex-shrink-0"
                  >
                    View All
                  </button>
                )}
              </div>

              {/* INDIVIDUAL PENDING USERS PREVIEW (UP TO 3) */}
              {pendingUsers.length > 0 && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-700/60 space-y-1.5">
                  {pendingUsers.slice(0, 3).map(user => {
                    const fullName = [user.first_name, user.surname].filter(Boolean).join(' ') || user.email;
                    const roleLabel = user.role === 'user' ? 'Independent Community' : (user.role?.toUpperCase() || 'Resident');
                    return (
                      <div key={user.id} className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{fullName}</p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{roleLabel}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {onQuickApproveUser && (
                            <button
                              type="button"
                              onClick={() => onQuickApproveUser(user.id, fullName)}
                              className="px-2 py-0.5 text-[11px] font-bold rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                              title="Instantly approve user"
                            >
                              Approve
                            </button>
                          )}
                          {onNavigateToUsers && (
                            <button
                              type="button"
                              onClick={() => {
                                onNavigateToUsers();
                                onClose();
                              }}
                              className="px-1.5 py-0.5 text-[11px] font-medium rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
                            >
                              Details
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {pendingUsers.length > 3 && (
                    <p className="text-[10px] text-center text-gray-400 dark:text-gray-500">
                      +{pendingUsers.length - 3} more pending registrations
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {pendingSharesCount > 0 && (
            <div className="flex items-center justify-between p-2.5 bg-white dark:bg-gray-800 rounded-xl border border-orange-200 dark:border-orange-800 shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center flex-shrink-0">
                  <ShareIcon className="w-4.5 h-4.5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                    {pendingSharesCount} Shared Report Request{pendingSharesCount > 1 ? 's' : ''}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Incoming corporate share</p>
                </div>
              </div>
              {onOpenSharing && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenSharing();
                    onClose();
                  }}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-orange-600 hover:bg-orange-500 text-white transition-colors cursor-pointer flex-shrink-0"
                >
                  Decide
                </button>
              )}
            </div>
          )}
        </div>
      )}
      
      <div className="flex-grow overflow-y-auto custom-scrollbar">
        {notifications.length === 0 && !hasPendingApprovals ? (
          <div className="text-center py-10">
            <CheckCircleIcon className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No new alerts or notifications.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {notifications.map(notification => (
              <li 
                key={notification.id} 
                className={`flex items-start gap-3 p-3.5 transition-colors cursor-pointer ${notification.is_read ? '' : 'bg-blue-50/50 dark:bg-blue-950/20'} hover:bg-gray-50 dark:hover:bg-gray-800/60`}
                onClick={() => onNotificationClick(notification)}
              >
                {!notification.is_read && <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0 animate-ping"></div>}
                <div className={`flex-shrink-0 ${notification.is_read ? 'ml-[18px]' : ''}`}>
                  <NotificationIcon type={notification.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs text-gray-900 dark:text-gray-100 truncate">{notification.title}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 break-words line-clamp-2">{notification.message}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 font-medium">
                    {safeFormatDistanceToNow(notification.created_at, { addSuffix: true })}
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
