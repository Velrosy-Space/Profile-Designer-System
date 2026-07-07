# Profile-Designer-System-
🎨 Discord Bot – Profile Designer v1



  <details>
  <summary><b><font size="5">📸 Preview / معاينة الصور</font></b></summary> 
  <br>

## 🎨 Profile Preview 

<img src="Assets/Profile_Preview_20260707031246.png" width="100%" />

## 🎨 Matching Profile Preview 

<img src="Assets/Matching-Preview_20260707030857.png" width="100%" />

  <br><br>
</details>

⚠️ ملاحظة 
: تأكد أن البوت لديه صلاحية إرسال الرسائل وإرفاق الملفات في هذه الرومات.
⚠️ Note
Make sure the bot has permissions to send messages and attach files in these channels.



## 🏆 Credits
- 👨‍💻 Developed by **Velrosy**
- 💡 Designed for easy use & full customization
- 📦 Uses `discord.js` v14 and other npm packages
- contact Me If You Need Help (valouyr) ⬅️ Discord User


## ⚙️ Configuration
Edit the `.env` file with your own bot token:
```.env
DISCORD_TOKEN=
```

Edit the 
```js
39 const INTERACTION_CHANNEL_ID = '1460649020354728149'; // 🎨 Channel where profile commands are received
40  // 🗂️ Destination channels based on profile type
41 const TARGET_CHANNELS = {
42  boy: { id: '1457845005518508275', label: 'Boy profile' }, // Boys profiles room id
43  girl: { id: '1457845307139162312', label: 'Girl profile' }, // Girls profiles room id
44  anime: { id: '1457845411388854495', label: 'Anime profile' } // Anime profiles room id
45 };

```
