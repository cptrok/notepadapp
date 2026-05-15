import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const saved = localStorage.getItem('memo_user');
    router.replace(saved ? '/app/note' : '/login');
  }, []);
  return null;
}
