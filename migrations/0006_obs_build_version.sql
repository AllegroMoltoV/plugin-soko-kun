-- リリースのタグの時点の buildspec.json に書かれた、ビルドに使う OBS Studio の版。NULL は未取得、空文字列は値が無いことを表す。
ALTER TABLE releases ADD COLUMN obs_build_version TEXT;
