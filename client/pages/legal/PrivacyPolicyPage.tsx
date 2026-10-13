import { ShieldCheck } from 'lucide-react';
import { Link } from '@client/src/utils/router';
import { Button } from '@client/src/components/ui/button';
import { APP_VERSION } from '@client/src/utils/version';
import { useAuth } from '@client/src/contexts/AuthContext';

const PrivacyPolicyPage = () => {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground sm:text-2xl">
                隐私说明
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
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              一、引言
            </h2>
            <p>
              hyacine小助手（以下简称"我们"）非常重视用户的隐私保护。本隐私说明旨在向您说明我们如何收集、使用、存储和保护您的个人信息。
            </p>
            <p>
              请您在使用本应用前，仔细阅读并充分理解本隐私说明的全部内容。您使用或继续使用本应用，即表示您同意我们按照本隐私说明处理您的个人信息。
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              二、数据收集范围
            </h2>
            <p>我们可能收集以下类型的信息：</p>
            <ul className="list-inside list-disc space-y-2 text-muted-foreground">
              <li>
                <strong>账号信息：</strong>用户名、密码（加密存储），用于您的账号注册和登录。
              </li>
              <li>
                <strong>使用数据：</strong>您的练习记录、错题记录、收藏内容、学习进度、设置偏好等，用于提供学习服务和个性化推荐。
              </li>
              <li>
                <strong>设备信息：</strong>设备名称、设备唯一标识符、登录 IP 地址、登录时间等，用于设备管理和安全验证。
              </li>
              <li>
                <strong>用户上传内容：</strong>您导入的题集、题目、标签、科目等数据，存储在您的个人空间中。
              </li>
              <li>
                <strong>反馈信息：</strong>您提交的反馈内容、联系方式（如您提供），用于改进产品和回复您的问题。
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              三、数据存储方式
            </h2>
            <ul className="list-inside list-disc space-y-2 text-muted-foreground">
              <li>您的个人数据存储在安全的数据库中，采用行业标准的加密技术进行保护。</li>
              <li>密码采用 PBKDF2-SHA256 哈希算法加密存储，我们无法获取您的明文密码。</li>
              <li>我们会采取合理的技术手段和管理措施，保护您的个人信息安全，防止信息泄露、损毁或丢失。</li>
              <li>数据存储地点：中国大陆境内的云服务器。</li>
              <li>除法律要求外，我们不会将您的数据存储在境外服务器。</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              四、数据使用方式
            </h2>
            <p>我们收集您的个人信息仅用于以下目的：</p>
            <ul className="list-inside list-disc space-y-2 text-muted-foreground">
              <li>提供、维护和改进本应用的核心服务功能；</li>
              <li>保存您的学习进度和个人设置；</li>
              <li>进行账号安全验证和异常登录检测；</li>
              <li>响应用户反馈和提供客服支持；</li>
              <li>在获得您同意的前提下，发送产品更新通知。</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              五、数据共享与披露
            </h2>
            <p>我们承诺不会向第三方出售您的个人信息。仅在以下情况下，我们可能会共享您的信息：</p>
            <ul className="list-inside list-disc space-y-2 text-muted-foreground">
              <li>获得您的明确同意或授权；</li>
              <li>根据法律法规的要求，或政府主管部门的强制性要求；</li>
              <li>为保护我们或您的合法权益所必需的情况。</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              六、用户权利
            </h2>
            <p>您对自己的个人信息享有以下权利：</p>
            <ul className="list-inside list-disc space-y-2 text-muted-foreground">
              <li>
                <strong>知情权：</strong>您有权了解我们如何收集和使用您的个人信息。
              </li>
              <li>
                <strong>访问权：</strong>您可以随时在应用内查看您的个人信息和使用数据。
              </li>
              <li>
                <strong>更正权：</strong>您可以修改您的个人资料和设置。
              </li>
              <li>
                <strong>删除权：</strong>您可以通过设置中的功能删除您的题集、记录等数据；如需注销账号，请联系客服。
              </li>
              <li>
                <strong>数据导出：</strong>您可以导出自己的题集数据为本地文件。
              </li>
              <li>
                <strong>撤回同意：</strong>您可以通过注销账号的方式撤回对本隐私说明的同意。
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              七、未成年人保护
            </h2>
            <p>
              我们非常重视未成年人的信息保护。如您是未满18周岁的未成年人，请在监护人的指导下使用本应用。
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              八、隐私说明的更新
            </h2>
            <p>
              我们可能会适时更新本隐私说明。更新后的说明将在本应用内公布，自公布之日起生效。请您定期查阅最新的隐私说明。
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              九、联系我们
            </h2>
            <p>
              如您对本隐私说明有任何疑问、意见或建议，或您希望行使上述权利，请通过以下方式联系我们：
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

export default PrivacyPolicyPage;
