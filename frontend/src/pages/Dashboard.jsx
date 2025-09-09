import { useEffect, useState } from 'react';
import API from '../services/api';

export default function Dashboard() {
  const [msg, setMsg] = useState('');

  useEffect(() => {
    API.get('/auth/dashboard')
      .then((res) => setMsg(res.data.message))
      .catch((err) => {
        alert('Unauthorized');
        setMsg('Please log in.');
      });
  }, []);

  return <div>{msg}</div>;
}
