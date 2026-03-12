-- 1. Profiles 表：存储用户信息与草药余额
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  herbs_balance INTEGER DEFAULT 0 CHECK (herbs_balance >= 0),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Payment Orders 表：存储充值订单
CREATE TABLE payment_orders (
  trade_order_id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  amount_cny DECIMAL(10, 2) NOT NULL,
  herbs_added INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Health Reports 表：存储生成的报告
CREATE TABLE health_reports (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  report_type TEXT CHECK (report_type IN ('wuyun', 'ziwei', 'spatial')),
  content JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. 开启 RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_reports ENABLE ROW LEVEL SECURITY;

-- 5. RLS 策略

-- Profiles: 用户只能查看和更新自己的 profile
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
-- 注意：herbs_balance 的增加应由后端通过 service_role 完成，不建议在前端直接 update

-- Payment Orders: 用户只能查看自己的订单
CREATE POLICY "Users can view own orders" ON payment_orders FOR SELECT USING (auth.uid() = user_id);

-- Health Reports: 用户只能查看自己的报告
CREATE POLICY "Users can view own reports" ON health_reports FOR SELECT USING (auth.uid() = user_id);

-- 6. 触发器：当 auth.users 创建新用户时，自动在 profiles 中插入记录
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, herbs_balance)
  VALUES (new.id, new.email, 0);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
