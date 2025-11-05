import axios from 'axios';

const API_URL = 'http://localhost:8000/api';

export const chatApi = {
    sendMessage: async (message) => {
        const resp = await axios.post(`${API_URL}/chat`, { message });
        return resp.data;
    }
};
