console.log("GTChat placeholder loaded");

export const showChatInterface = () => {
  console.log('showChatInterface called');
};

export const addGTMessage = () => {
  console.log('addGTMessage called');
};

export const updateStreamingMessage = (chunk: any) => {
  console.log('updateStreamingMessage called with:', chunk);
};

export const finalizeMessage = () => {
  console.log('finalizeMessage called');
};

export const hideChatInterface = () => {
  console.log('hideChatInterface called');
};
