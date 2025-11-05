import axios from 'axios';

const API_URL = 'http://localhost:8000/api';

export const chatApi = {
    sendMessage: async (message) => {
        try {
            const response = await axios.post(`${API_URL}/chat`, { message });
            return response.data;
        } catch (error) {
            console.error('Error:', error);
            throw error;
        }
    }
};
