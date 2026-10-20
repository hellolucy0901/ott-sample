import { create } from "zustand";
import { auth, db } from "../firebase/firebase";
import { useAuthStore } from "./useAuthStore";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export const useHeartStore = create((set, get) => ({
    // 찜리스트를 저장할 배열
    hearts: [],

    // 저장된 찜리스트 불러오기
    onLoadHearts: async () => {
        const user = auth.currentUser;
        if (!user) return;
        const currentMember = useAuthStore.getState().currentMember;
        if (!currentMember) return;

        try {
            // firebase 사용자계정
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const likes = userDoc.data()?.familyMembers?.[currentMember]?.likes || [];
                set({ hearts: likes });
            }

        } catch (err) {
            console.log("찜리스트 불러오기 오류", err);
        }
    },

    // 토글
    onToggleHearts: async (item) => {
        // 현재 찜한 항목인지 확인
        const isHeart = get().onIsHeart(item.id);

        if (isHeart) {
            // 이미 찜한 항목이면 삭제
            await get().onRemoveHearts(item.id);
        } else {
            // 찜하지 않은 항목이면 추가
            await get().onAddHearts(item);
        }
    },

    // 찜하기 추가
    onAddHearts: async (item) => {
        const user = auth.currentUser;
        if (!user) return;
        const currentMember = useAuthStore.getState().currentMember;
        if (!currentMember) return;

        const heartItem = {
            id: item.id,
            title: "title" in item ? item.title : item.name,
            poster_path: item.poster_path
        };

        // 기존 찜 목록
        const prevHearts = get().hearts;

        // 클릭 즉시 Zustand 업데이트
        const newHearts = [
            heartItem,
            ...prevHearts.filter((h) => h.id !== item.id)
        ];

        set({ hearts: newHearts });

        try {
            // firebase 에 저장하기
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const prevHeart =
                    userDoc.data()?.familyMembers?.[currentMember]?.likes || [];

                const filtered = prevHeart.filter((h) => h.id !== item.id);
                const newHeart = [heartItem, ...filtered];

                await updateDoc(userDocRef, {
                    [`familyMembers.${currentMember}.likes`]: newHeart
                });

                set({ hearts: newHeart });
            } else {
                set({ hearts: prevHearts });
                console.log("사용자 문서 없음");
            }

        } catch (err) {
            // Firebase 저장 실패 시 이전 상태로 복구
            set({ hearts: prevHearts });
            console.log("찜오류", err.message);
        }
    },

    // 삭제
    onRemoveHearts: async (id) => {
        const user = auth.currentUser;
        if (!user) return;
        const currentMember = useAuthStore.getState().currentMember;
        if (!currentMember) return;

        // 기존 찜 목록
        const prevHearts = get().hearts;

        // 클릭 즉시 Zustand 업데이트
        const newHearts = prevHearts.filter((h) => h.id !== id);

        set({ hearts: newHearts });

        try {
            // firebase 사용자계정
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const likes =
                    userDoc.data()?.familyMembers?.[currentMember]?.likes || [];

                const filtered = likes.filter((h) => h.id !== id);

                await updateDoc(userDocRef, {
                    [`familyMembers.${currentMember}.likes`]: filtered
                });

                set({ hearts: filtered });
            } else {
                set({ hearts: prevHearts });
                console.log("사용자 문서 없음");
            }

        } catch (err) {
            // Firebase 삭제 실패 시 이전 상태로 복구
            set({ hearts: prevHearts });
            console.log("찜삭제 오류", err.message);
        }
    },

    // 하트의 상태를 변경해줄 메서드
    onIsHeart: (id) => {
        // some 데이터가 배열의 객체로 있는지를 체크해서 true/false를 반환
        return get().hearts.some((h) => h.id === id);
    }
}));