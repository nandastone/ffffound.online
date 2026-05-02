-- Synthetic seed data so `wrangler dev` shows realistic-looking pages
-- before we have real WARC extraction. Safe to re-run: clears + reinserts.

DELETE FROM image_tags;
DELETE FROM saves;
DELETE FROM images_fts;
DELETE FROM images;
DELETE FROM tags;
DELETE FROM users;

INSERT INTO users (username, display_name, joined_at, bio, save_count) VALUES
  ('amelia',   'Amelia',     1199145600, 'designer · brooklyn',   42),
  ('boris',    'Boris K.',   1230768000, NULL,                    19),
  ('cyclops',  'cyclops',    1262304000, 'one eye open',          88),
  ('delphine', 'Delphine',   1293840000, 'colour fields',         13),
  ('eero',     'eero',       1325376000, 'finnish/typography',    27),
  ('fukuda',   'M. Fukuda',  1356998400, NULL,                    51),
  ('gretel',   'gretel',     1388534400, NULL,                     7),
  ('hayao',    'hayao',      1420070400, 'film stills mostly',    34),
  ('isolde',   'Isolde',     1451606400, NULL,                    22),
  ('juno',     'juno',       1483228800, 'archive curator',      105);

INSERT INTO tags (tag, use_count) VALUES
  ('photography', 12),
  ('design',       9),
  ('typography',   8),
  ('illustration', 7),
  ('film',         6),
  ('texture',      5),
  ('analog',       5),
  ('print',        4),
  ('blue',         4),
  ('grain',        3),
  ('found',        3),
  ('night',        2);

-- 24 images. r2_key is null on purpose for half of them — we want the UI to
-- handle "image bytes not in archive" cases too.
INSERT INTO images (image_id, uploader, source_url, source_dead, cdn_thumbnail_url, r2_key, width, height, uploaded_at, comment_count, save_count) VALUES
  ('1001', 'amelia',  'http://example.com/dead-1',  1, 'http://static.ffffound.com/static-data/images/m/1001.jpg', 'fake/1001.jpg', 800, 600, 1199145700,  3, 14),
  ('1002', 'boris',   'http://example.com/dead-2',  1, 'http://static.ffffound.com/static-data/images/m/1002.jpg', 'fake/1002.jpg', 800, 1200, 1199232000, 1,  6),
  ('1003', 'cyclops', 'http://example.com/dead-3',  1, 'http://static.ffffound.com/static-data/images/m/1003.jpg', 'fake/1003.jpg', 1200, 800, 1199318400, 5, 22),
  ('1004', 'delphine','http://example.com/dead-4',  1, 'http://static.ffffound.com/static-data/images/m/1004.jpg', 'fake/1004.jpg', 1000, 1000, 1199404800, 0,  3),
  ('1005', 'eero',    'http://example.com/dead-5',  1, 'http://static.ffffound.com/static-data/images/m/1005.jpg', 'fake/1005.jpg', 600, 900,  1199491200, 2, 11),
  ('1006', 'fukuda',  'http://example.com/dead-6',  1, 'http://static.ffffound.com/static-data/images/m/1006.jpg', 'fake/1006.jpg', 900, 600,  1199577600, 4, 18),
  ('1007', 'gretel',  'http://example.com/dead-7',  1, 'http://static.ffffound.com/static-data/images/m/1007.jpg', 'fake/1007.jpg', 1200, 1200, 1199664000, 0,  2),
  ('1008', 'hayao',   'http://example.com/dead-8',  1, 'http://static.ffffound.com/static-data/images/m/1008.jpg', 'fake/1008.jpg', 1600, 900,  1199750400, 7, 31),
  ('1009', 'isolde',  'http://example.com/dead-9',  1, 'http://static.ffffound.com/static-data/images/m/1009.jpg', 'fake/1009.jpg', 800, 800,  1199836800, 1,  5),
  ('1010', 'juno',    'http://example.com/dead-10', 1, 'http://static.ffffound.com/static-data/images/m/1010.jpg', 'fake/1010.jpg', 1200, 1600, 1199923200, 9, 44),
  ('1011', 'amelia',  'http://example.com/dead-11', 1, 'http://static.ffffound.com/static-data/images/m/1011.jpg', 'fake/1011.jpg', 800, 600,  1200009600, 0,  4),
  ('1012', 'cyclops', 'http://example.com/dead-12', 1, 'http://static.ffffound.com/static-data/images/m/1012.jpg', 'fake/1012.jpg', 800, 1200, 1200096000, 2,  9),
  ('1013', 'fukuda',  'http://example.com/dead-13', 1, 'http://static.ffffound.com/static-data/images/m/1013.jpg', NULL,            1200, 800, 1200182400, 0,  1),
  ('1014', 'hayao',   'http://example.com/dead-14', 1, 'http://static.ffffound.com/static-data/images/m/1014.jpg', NULL,            1000, 1000, 1200268800, 3, 12),
  ('1015', 'juno',    'http://example.com/dead-15', 1, 'http://static.ffffound.com/static-data/images/m/1015.jpg', NULL,            600, 900,  1200355200, 1,  6),
  ('1016', 'delphine','http://example.com/dead-16', 1, 'http://static.ffffound.com/static-data/images/m/1016.jpg', NULL,            900, 600,  1200441600, 0,  2),
  ('1017', 'boris',   'http://example.com/dead-17', 1, 'http://static.ffffound.com/static-data/images/m/1017.jpg', NULL,            1200, 1200, 1200528000, 0,  1),
  ('1018', 'eero',    'http://example.com/dead-18', 1, 'http://static.ffffound.com/static-data/images/m/1018.jpg', NULL,            1600, 900,  1200614400, 4, 16),
  ('1019', 'gretel',  'http://example.com/dead-19', 1, 'http://static.ffffound.com/static-data/images/m/1019.jpg', NULL,            800, 800,  1200700800, 0,  3),
  ('1020', 'isolde',  'http://example.com/dead-20', 1, 'http://static.ffffound.com/static-data/images/m/1020.jpg', NULL,            1200, 1600, 1200787200, 2,  8),
  ('1021', 'juno',    'http://example.com/dead-21', 1, 'http://static.ffffound.com/static-data/images/m/1021.jpg', NULL,            800, 600,  1200873600, 0,  3),
  ('1022', 'amelia',  'http://example.com/dead-22', 1, 'http://static.ffffound.com/static-data/images/m/1022.jpg', NULL,            800, 1200, 1200960000, 1,  5),
  ('1023', 'fukuda',  'http://example.com/dead-23', 1, 'http://static.ffffound.com/static-data/images/m/1023.jpg', NULL,            1200, 800, 1201046400, 6, 24),
  ('1024', 'hayao',   'http://example.com/dead-24', 1, 'http://static.ffffound.com/static-data/images/m/1024.jpg', NULL,            1000, 1000, 1201132800, 0,  2);

-- Tag mappings — each image gets 1–3 tags.
INSERT INTO image_tags (image_id, tag) VALUES
  ('1001','photography'),('1001','blue'),
  ('1002','typography'),('1002','print'),
  ('1003','film'),('1003','grain'),
  ('1004','design'),
  ('1005','illustration'),('1005','found'),
  ('1006','photography'),('1006','texture'),
  ('1007','design'),('1007','typography'),
  ('1008','film'),('1008','night'),
  ('1009','analog'),('1009','grain'),
  ('1010','photography'),
  ('1011','design'),('1011','print'),
  ('1012','film'),('1012','blue'),
  ('1013','illustration'),
  ('1014','film'),('1014','analog'),
  ('1015','typography'),
  ('1016','texture'),
  ('1017','found'),
  ('1018','photography'),('1018','night'),
  ('1019','illustration'),
  ('1020','design'),('1020','typography'),
  ('1021','blue'),
  ('1022','print'),
  ('1023','photography'),('1023','grain'),
  ('1024','film');

-- Saves — each image saved by 0–4 users.
INSERT INTO saves (image_id, username, saved_at) VALUES
  ('1001','boris',1199146000),('1001','cyclops',1199146100),('1001','juno',1199146200),
  ('1002','amelia',1199232100),
  ('1003','juno',1199318500),('1003','hayao',1199318600),('1003','delphine',1199318700),('1003','amelia',1199318800),
  ('1005','fukuda',1199491300),('1005','juno',1199491400),
  ('1006','isolde',1199577700),('1006','juno',1199577800),('1006','amelia',1199577900),
  ('1008','juno',1199750500),('1008','cyclops',1199750600),('1008','eero',1199750700),
  ('1010','amelia',1199923300),('1010','boris',1199923400),('1010','cyclops',1199923500),('1010','delphine',1199923600),
  ('1012','juno',1200096100),
  ('1014','juno',1200268900),('1014','isolde',1200269000),
  ('1018','juno',1200614500),('1018','hayao',1200614600),
  ('1020','amelia',1200787300),
  ('1023','juno',1201046500),('1023','cyclops',1201046600),('1023','eero',1201046700);

-- FTS5 mirror. Seeding directly is fine for synthetic data; the parser will
-- maintain this incrementally for real data via triggers (added in a later migration).
INSERT INTO images_fts (image_id, uploader, tags_text)
  SELECT i.image_id,
         i.uploader,
         IFNULL((SELECT GROUP_CONCAT(tag, ' ') FROM image_tags WHERE image_id = i.image_id), '')
  FROM images i;
