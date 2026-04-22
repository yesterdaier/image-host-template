import { createApp } from 'vue'
import App from './App.vue'
import {
  create,
  NButton,
  NInput,
  NCard,
  NCollapse,
  NCollapseItem,
  NGrid,
  NGridItem,
  NSpace,
  NSpin,
  NEmpty,
  NMessageProvider,
  NDialogProvider,
  NUpload,
  NProgress,
  NTag,
  NIcon,
  NTooltip,
  NP,
  NH1,
  NH3,
  NDivider,
  NConfigProvider,
  zhCN,
  dateZhCN,
} from 'naive-ui'

const naive = create({
  components: [
    NButton, NInput, NCard, NCollapse, NCollapseItem,
    NGrid, NGridItem, NSpace, NSpin, NEmpty,
    NMessageProvider, NDialogProvider, NUpload,
    NProgress, NTag, NIcon, NTooltip,
    NP, NH1, NH3, NDivider, NConfigProvider,
  ],
})

const app = createApp(App)
app.use(naive)
app.mount('#app')
