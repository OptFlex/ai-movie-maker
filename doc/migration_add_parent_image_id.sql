-- imagesテーブルにparent_image_idカラムを追加
-- 前回の生成画像を参照するための外部キー

ALTER TABLE images
ADD COLUMN parent_image_id UUID REFERENCES images(id) ON DELETE SET NULL;

-- parent_image_idのインデックスを追加（参照元を辿る際に高速化）
CREATE INDEX idx_images_parent_id ON images(parent_image_id);

-- 確認
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'images'
ORDER BY ordinal_position;
