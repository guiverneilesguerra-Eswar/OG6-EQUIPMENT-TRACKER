export interface CommandAlertButton { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }
export interface CommandAlertData { title: string; message?: string; buttons: CommandAlertButton[] }
