import { createContext, useContext, useState, useEffect } from 'react';

const LikeContext = createContext();
const STORAGE_KEY = 'ziishe_likes';

// Liked products are kept on the device, the same way the cart is, so a
// visitor can like pieces before signing in and the list survives a refresh.
const readStoredLikes = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
};

export const LikeProvider = ({ children }) => {
  const [likes, setLikes] = useState(readStoredLikes);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(likes));
  }, [likes]);

  const isLiked = (productId) => likes.some((p) => p._id === productId);

  const toggleLike = (product) => {
    setLikes((prev) =>
      prev.some((p) => p._id === product._id)
        ? prev.filter((p) => p._id !== product._id)
        : [product, ...prev]
    );
  };

  const removeLike = (productId) => {
    setLikes((prev) => prev.filter((p) => p._id !== productId));
  };

  const clearLikes = () => setLikes([]);

  return (
    <LikeContext.Provider
      value={{ likes, likeCount: likes.length, isLiked, toggleLike, removeLike, clearLikes }}
    >
      {children}
    </LikeContext.Provider>
  );
};

export const useLike = () => useContext(LikeContext);
