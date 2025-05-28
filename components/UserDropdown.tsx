import { Menu, Transition } from '@headlessui/react';
import { Fragment, useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import md5 from 'md5';
import { RefreshCw } from 'lucide-react';

interface UserDropdownProps {
  user: {
    email: string;
    uid: string;
  };
  onRefresh?: () => void;
}

interface UserData {
  username: string;
  firstName: string;
  lastName: string;
}

interface CallStats {
  totalCalls: number;
  lastCallAt: Date;
}

export default function UserDropdown({ user, onRefresh }: UserDropdownProps) {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [callStats, setCallStats] = useState<CallStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchUserData = async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const statsDoc = await getDoc(doc(db, 'callstats', user.uid));
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserData({
          username: data.username,
          firstName: data.firstName,
          lastName: data.lastName,
        });
      }

      if (statsDoc.exists()) {
        const data = statsDoc.data();
        setCallStats({
          totalCalls: data.totalCalls || 0,
          lastCallAt: data.lastCallAt?.toDate() || new Date(),
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [user.uid]);

  useEffect(() => {
    if (onRefresh) {
      onRefresh();
    }
  }, [callStats, onRefresh]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleRefresh = async () => {
    await fetchUserData(true);
  };

  const gravatarUrl = `https://www.gravatar.com/avatar/${md5(user.email.toLowerCase().trim())}?d=mp`;

  const LoadingPulse = ({ className }: { className: string }) => (
    <div className={`${className} bg-gray-700 animate-[pulse_1.5s_ease-in-out_infinite] rounded`} />
  );

  return (
    <Menu as="div" className="relative inline-block text-left z-50">
      <Menu.Button className="flex items-center space-x-3 group">
        <div className="relative">
          {isLoading ? (
            <div className="w-8 h-8 rounded-full bg-gray-700 animate-[pulse_1.5s_ease-in-out_infinite]" />
          ) : (
            <img
              src={gravatarUrl}
              alt="User avatar"
              className="w-8 h-8 rounded-full border-2 border-white/10 transition-all duration-200 group-hover:border-white/20"
            />
          )}
        </div>
        <span className="text-white min-w-[80px]">
          {isLoading ? (
            <LoadingPulse className="w-20 h-4" />
          ) : (
            <span className="transition-colors duration-200 group-hover:text-blue-200">
              {userData?.username}
            </span>
          )}
        </span>
      </Menu.Button>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-200"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-150"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 mt-3 w-64 origin-top-right rounded-xl bg-gray-900/95 backdrop-blur-sm border border-gray-700/50 shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
          <div className="px-4 py-4 border-b border-gray-700/50">
            {isLoading ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <LoadingPulse className="w-12 h-12 rounded-full" />
                  <div className="space-y-2">
                    <LoadingPulse className="w-24 h-4" />
                    <LoadingPulse className="w-20 h-3" />
                  </div>
                </div>
                <div className="space-y-2">
                  <LoadingPulse className="w-32 h-3" />
                  <div className="pt-3 border-t border-gray-700/50 space-y-2">
                    <LoadingPulse className="w-36 h-3" />
                    <LoadingPulse className="w-32 h-3" />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <img
                      src={gravatarUrl}
                      alt="User avatar"
                      className="w-12 h-12 rounded-full border-2 border-gray-700/50"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-200">{userData?.username}</span>
                      <p className="text-xs text-gray-400 mt-1">
                        {userData?.firstName} {userData?.lastName}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleRefresh}
                    className="text-gray-400 hover:text-gray-200 transition-colors"
                    disabled={isRefreshing}
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <p className="text-xs text-gray-500 truncate mb-3">{user.email}</p>
                {callStats && (
                  <div className="pt-3 border-t border-gray-700/50">
                    <div className="flex justify-between items-center text-xs text-gray-400">
                      <span>Total Calls</span>
                      <span className="font-medium">
                        {isRefreshing ? (
                          <span className="text-blue-400">Refreshing...</span>
                        ) : (
                          callStats.totalCalls
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-400 mt-2">
                      <span>Last Call</span>
                      <span className="font-medium">
                        {isRefreshing ? (
                          <span className="text-blue-400">Refreshing...</span>
                        ) : (
                          callStats.lastCallAt.toLocaleDateString()
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="p-1">
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={handleSignOut}
                  className={`${
                    active ? 'bg-gray-800/80' : ''
                  } text-red-400 w-full text-left px-3 py-2 text-sm rounded-md transition-colors duration-150`}
                >
                  Sign Out
                </button>
              )}
            </Menu.Item>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}