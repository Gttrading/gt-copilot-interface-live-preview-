console.log("GTAuth placeholder loaded");

export interface User {
    id: string;
    name: string;
    email: string;
    provider: string;
    isAdmin: boolean;
}

export const getCurrentUser = (): User | null => {
  console.log('getCurrentUser called');
  // Return a dummy user to simulate being logged in, otherwise the modal will always show.
  return {
      id: 'placeholder_user',
      name: 'Placeholder User',
      email: 'placeholder@gt.com',
      provider: 'local',
      isAdmin: true
  };
};

export const showLoginModal = (callback: (user: User) => void) => {
  console.log('showLoginModal called');
  // to avoid breaking the app flow, let's immediately call the callback with a dummy user
  callback({
      id: 'placeholder_user_from_modal',
      name: 'Placeholder User',
      email: 'placeholder@gt.com',
      provider: 'local',
      isAdmin: false
  });
};

// FIX: Add isLoggedIn function to satisfy usage in GTHamburgerMenu.tsx
export const isLoggedIn = (): boolean => {
    return getCurrentUser() !== null;
};

// FIX: Add logout function to satisfy usage in GTHamburgerMenu.tsx
export const logout = () => {
    console.log('logout called');
    // In a real app, this would clear session/local storage.
};
