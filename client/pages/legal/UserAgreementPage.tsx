import { FileText, AlertTriangle } from 'lucide-react';
import { Link } from '@client/src/utils/router';
import { Button } from '@client/src/components/ui/button';
import { APP_VERSION } from '@client/src/utils/version';
import { useAuth } from '@client/src/contexts/AuthContext';

const UserAgreementPage = () => {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground sm:text-2xl">
                用户协议
              </h1>
              <p className="text-xs text-muted-foreground">
                最后更新：2026年8月23日
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/login">返回</Link>
          </Button>
        </div>

        <div className="space-y-6 rounded-xl border border-border/60 bg-card p-6 text-sm leading-relaxed text-foreground shadow-sm sm:p-8">
          <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold text-amber-800">
                本工具仅用于个人学习自测，禁止用于任何正式考试或作弊行为
              </p>
              <p className="mt-1 text-xs text-amber-700">
                hyacine小助手是个人知识点整理与自学自测复习工具。
                所有内容仅供个人学习参考，严禁在正式考试、测验或考核中使用。
                因违规使用所产生的一切后果由使用者自行承担。
              </p>
            </div>
          </div>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              一、总则
            </h2>
            <p>
              欢迎使用 hyacine小助手（以下简称"本应用"）。本协议是您与本应用之间关于使用本应用服务所订立的协议。请您在注册或使用本应用之前，仔细阅读本协议的全部内容。
            </p>
            <p>
              您一旦注册或使用本应用，即视为您已阅读、理解并同意接受本协议全部条款的约束。如您不同意本协议的任何内容，请不要注册或使用本应用。
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              二、用户使用规范
            </h2>
            <ul className="list-inside list-disc space-y-2 text-muted-foreground">
              <li>您承诺以合法、合规的方式使用本应用，不得利用本应用从事任何违法违规活动。</li>
              <li>您应妥善保管自己的账号和密码，对账号下发生的所有活动承担责任。</li>
              <li>您不得将账号借给他人使用，不得盗用他人账号。</li>
              <li>您不得上传、传播含有违法违规、淫秽色情、暴力恐怖、侵犯他人权益等内容的数据。</li>
              <li>您不得对本应用进行反向工程、反向汇编、反向编译，或者以其他方式尝试发现本应用的源代码。</li>
              <li>您不得干扰或破坏本应用的正常运行，不得使用任何技术手段攻击或干扰本应用的服务器。</li>
               <li>您使用本应用产生的内容（包括但不限于导入的题目、创建的题集等）由您自行负责，本应用不对其准确性、完整性或合法性承担责任。</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              三、禁止用于正式考试
            </h2>
            <p className="font-medium text-destructive">
              重要提示：本应用仅供学习交流和备考复习使用，严禁在任何正式考试、测验或考核中使用本应用或通过本应用获取的内容。
            </p>
            <ul className="list-inside list-disc space-y-2 text-muted-foreground">
               <li>本应用的题目和内容仅供个人学习参考，不构成任何考试的官方题集。</li>
               <li>禁止将本应用的题目和答案以任何形式带入考场或用于考试作弊行为。</li>
              <li>因违反考试纪律或相关规定使用本应用所产生的一切后果，由使用者自行承担，本应用不承担任何法律责任。</li>
              <li>请自觉遵守考试纪律，诚信应考。</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              四、免责声明
            </h2>
            <ul className="list-inside list-disc space-y-2 text-muted-foreground">
              <li>本应用提供的所有内容仅供参考，不保证内容的准确性、完整性或可靠性。</li>
              <li>本应用可能因不可抗力、系统维护、网络故障等原因导致服务中断，对此本应用不承担责任。</li>
              <li>您因使用或无法使用本应用而造成的任何直接或间接损失，本应用仅在法律允许的范围内承担责任。</li>
               <li>用户导入的第三方内容（如题集、题目等）由用户自行负责，如涉及版权或其他法律纠纷，本应用不承担责任。</li>
              <li>本应用有权根据实际情况调整、变更或终止部分或全部服务，并有权在必要时修改本协议。</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              五、知识产权
            </h2>
            <p>
              本应用的所有内容，包括但不限于文字、图片、音频、视频、软件、程序、版面设计、栏目设置与名称等，均受相关法律法规保护，其知识产权归本应用或相关权利人所有。
            </p>
            <p>
              未经本应用或相关权利人书面同意，任何人不得以任何形式擅自使用、复制、传播、修改本应用的任何内容。
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              六、协议变更
            </h2>
            <p>
              本应用有权根据需要随时修改本协议内容。修改后的协议将在本应用内公布，自公布之日起生效。您继续使用本应用服务，即视为您接受修改后的协议。
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              七、联系我们
            </h2>
            <p>
              如您对本协议有任何疑问或建议，请通过以下方式联系我们：
            </p>
            <p className="text-muted-foreground">邮箱：1691917356@qq.com</p>
          </section>

          <div className="border-t border-border/60 pt-4 text-center text-xs text-muted-foreground space-y-1">
            <div>{APP_VERSION}</div>
            {user?.uid && <div>UID: {user.uid}</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserAgreementPage;
