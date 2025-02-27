import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAAWZQjdiwfANFIY41aMKMEuN_8kAfIeAo",
  authDomain: "chat-app-v3-74851.firebaseapp.com",
  projectId: "chat-app-v3-74851",
  storageBucket: "chat-app-v3-74851.firebasestorage.app",
  messagingSenderId: "607921280569",
  appId: "1:607921280569:web:a44513f4f38e3ac7c85fe8",
  measurementId: "G-RJQM5K8Q8R",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
