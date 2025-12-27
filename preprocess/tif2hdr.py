import cv2
import numpy as np
import os

def convert_tif_to_hdr(input_path, output_path, to_linear=True):
    """
    将 TIF 图像转换为 HDR 格式。
    
    Args:
        input_path (str): 输入 TIF 文件的路径。
        output_path (str): 输出 HDR 文件的路径 (需以 .hdr 结尾)。
        to_linear (bool): 是否将 sRGB 转换为线性空间 (推荐用于天空盒)。
    """
    
    # 1. 读取图像
    # IMREAD_UNCHANGED 确保如果原图是 16-bit，读取进来也是 16-bit，不会被压缩成 8-bit
    img = cv2.imread(input_path, cv2.IMREAD_UNCHANGED)
    
    if img is None:
        print(f"❌ 错误: 无法读取文件 {input_path}，请检查路径。")
        return

    print(f"📸 原始图像信息: 尺寸={img.shape}, 数据类型={img.dtype}")

    # 2. 数据类型归一化 (转换为 0.0 - 1.0 的 float32)
    img = img.astype(np.float32)
    
    # 检测原始位深并归一化
    # 如果原始是 16-bit (0-65535) -> 除以 65535
    # 如果原始是 8-bit (0-255) -> 除以 255
    if img.max() > 255.0:
        print("ℹ️ 检测到 16-bit 输入，正在归一化...")
        img = img / 65535.0
    else:
        print("ℹ️ 检测到 8-bit 输入，正在归一化...")
        img = img / 255.0

    # 3. 色彩空间转换 (Gamma -> Linear)
    # 大多数 TIF 是 sRGB (Gamma 2.2)，而 HDR skybox 在渲染引擎中通常需要 Linear 空间
    if to_linear:
        print("🎨 正在执行 Gamma 校正 (sRGB -> Linear)...")
        # 简单近似: pixel ^ 2.2
        # 防止 0 值导致错误，加上极小值或直接计算
        img = np.power(img, 2.2)

    # 4. 保存为 HDR
    # OpenCV 的 imwrite 会根据 .hdr 后缀自动使用 Radiance 编码保存
    success = cv2.imwrite(output_path, img)
    
    if success:
        print(f"✅ 成功! 文件已保存至: {output_path}")
    else:
        print("❌ 保存失败，请检查输出路径及权限。")

# --- 使用示例 ---
if __name__ == "__main__":
    # 输入文件路径 (确保你的图片是 2:1 的全景图，例如 4096x2048)
    input_tif = "panorama_input.tif" 
    output_hdr = "skybox_output.hdr"
    
    # 检查文件是否存在
    if not os.path.exists(input_tif):
        # 创建一个测试用的黑色 TIF 文件，防止代码报错，方便你测试逻辑
        print("⚠️ 没找到输入文件，正在生成测试用 TIF...")
        dummy_img = np.zeros((1024, 2048, 3), dtype=np.uint8)
        cv2.imwrite(input_tif, dummy_img)

    convert_tif_to_hdr(input_tif, output_hdr, to_linear=True)


if __name__ == "__main__":
    input_tif = r"D:\\04_Dev\\01_TempFactory\\2025\\12\\CGFinal\\eto\\public\\hdr\\eso0932a_4k.tif"
    output_hdr = r"D:\\04_Dev\\01_TempFactory\\2025\\12\\CGFinal\\eto\\public\\hdr\\eso0932a_4k.hdr"

    # 检查文件是否存在
    if not os.path.exists(input_tif):
        # 创建一个测试用的黑色 TIF 文件，防止代码报错，方便你测试逻辑
        print("⚠️ 没找到输入文件，正在生成测试用 TIF...")
        dummy_img = np.zeros((1024, 2048, 3), dtype=np.uint8)
        cv2.imwrite(input_tif, dummy_img)

    convert_tif_to_hdr(input_tif, output_hdr, to_linear=True)